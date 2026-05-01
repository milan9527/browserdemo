# AgentCore Browser Demo — DCV Live View

A demo platform showcasing **Amazon Bedrock AgentCore Browser** with **DCV Live View** streaming. A **Strands agent deployed on AgentCore Runtime** uses `AgentCoreBrowser` to navigate websites, fill forms, and extract data — all visible in real time through the DCV protocol.

## Architecture

```
┌─────────────────┐     REST      ┌──────────────────┐   agentcore invoke   ┌──────────────────┐
│  React Frontend │◄────────────►│  Fastify Server   │◄────────────────────►│  AgentCore       │
│                 │              │                   │                      │  Runtime         │
│  BrowserLive    │              │  • Start session  │                      │  ┌────────────┐  │
│  View (DCV)     │              │  • Gen live URL   │                      │  │ Strands    │  │
│                 │              │  • Invoke agent   │                      │  │ Agent      │  │
│  Activity Log   │              │  • Manage profiles│                      │  │ + Browser  │  │
└────────┬────────┘              └───────────────────┘                      │  └─────┬──────┘  │
         │                                                                 └────────┼─────────┘
         │              DCV WebSocket (direct)                                      │
         │                                                          Playwright CDP  │
         │                                                                 ┌────────▼─────────┐
         └─────────────────────────────────────────────────────────────────►│  AgentCore       │
                                                                           │  Browser         │
                                                                           │  (Chrome)        │
                                                                           └──────────────────┘
```

The DCV Live View stream flows **directly** from AgentCore Browser to the client — no video passes through your server.

## Demo Scenarios

| Demo | What it shows |
|------|--------------|
| 🌐 **Web Crawl** | Strands agent navigates public sites, extracts content, summarizes findings |
| 🔐 **Auth Login** | Agent fills login forms, submits credentials, performs authenticated actions |
| 💾 **Persistent Session** | Browser profiles persist cookies/localStorage — login once, reuse across sessions |
| 🤖 **Custom Agent** | Free-form prompt to the Strands agent with AgentCoreBrowser |

## Agent Modes

The server supports three modes (set via `AGENT_MODE` env var):

| Mode | Description |
|------|-------------|
| `runtime` (default) | Invokes the Strands agent deployed on AgentCore Runtime via `agentcore invoke` |
| `local` | Calls the local `agentcore dev` server at `localhost:8080` |
| `direct` | Falls back to a Bedrock Converse loop with simulated browser tools |

## Prerequisites

- **Node.js 20+** — for the Fastify server and React frontend
- **Python 3.10+** — for the Strands agent
- **AWS credentials** with AgentCore Browser + Bedrock permissions
- **AgentCore CLI** — `pip install bedrock-agentcore-starter-toolkit`
- **Bedrock model access** — Claude Sonnet or similar with tool use

## Quick Start

### 1. Deploy the Strands Agent

```bash
cd agent/
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# Test locally
agentcore dev                    # starts on port 8080
agentcore invoke --dev '{"prompt": "Navigate to wikipedia.org and get the page title"}'

# Deploy to AgentCore Runtime
agentcore configure --entrypoint src/main.py --non-interactive
agentcore launch
```

### 2. Start the Demo Platform

```bash
# Install frontend + server dependencies
npm install

# Set AWS credentials
export AWS_ACCESS_KEY_ID=<your-key>
export AWS_SECRET_ACCESS_KEY=<your-secret>
export AWS_SESSION_TOKEN=<your-token>
export AWS_REGION=us-west-2

# Choose agent mode
export AGENT_MODE=runtime   # or: local, direct

# Start development servers
npm run dev

# Open http://localhost:5173
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-west-2` | AWS region for AgentCore |
| `BROWSER_IDENTIFIER` | `aws.browser.v1` | Browser tool identifier |
| `BEDROCK_MODEL_ID` | `anthropic.claude-sonnet-4-20250514-v1:0` | Model for the agent |
| `AGENT_MODE` | `runtime` | Agent invocation mode: `runtime`, `local`, `direct` |
| `AGENT_PORT` | `8080` | Port for local dev server (when `AGENT_MODE=local`) |

## Project Structure

```
├── agent/                         # Python Strands agent (deployed to AgentCore Runtime)
│   ├── src/main.py                # Agent entrypoint with AgentCoreBrowser tool
│   ├── .bedrock_agentcore.yaml    # AgentCore Runtime config
│   ├── pyproject.toml             # Python dependencies
│   └── requirements.txt
├── server/                        # Fastify backend (TypeScript)
│   ├── index.ts                   # Server entry point
│   ├── lib/
│   │   ├── agentcore-browser.ts   # AgentCore Browser SDK wrapper (sessions, profiles, live view)
│   │   └── browser-agent.ts       # Agent invoker (runtime / local / direct modes)
│   └── routes/
│       ├── demos.ts               # Demo scenario endpoints
│       ├── sessions.ts            # Session management
│       └── profiles.ts            # Browser profile management
├── src/                           # React frontend (Vite + Tailwind)
│   ├── components/
│   │   ├── Layout.tsx             # App shell with sidebar
│   │   ├── LiveViewPanel.tsx      # DCV live view renderer
│   │   ├── ActivityLog.tsx        # Agent step timeline
│   │   ├── PromptInput.tsx        # Prompt input + launch button
│   │   └── CodeSnippet.tsx        # Code display
│   ├── pages/
│   │   ├── DemoPage.tsx           # Main demo view
│   │   ├── SessionsPage.tsx       # Session management UI
│   │   └── ProfilesPage.tsx       # Profile management UI
│   └── lib/
│       ├── api.ts                 # API client
│       └── demo-configs.ts        # Demo metadata + code samples
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Demo Mode

The platform works **without AWS credentials** — it simulates agent steps and renders a placeholder live view. Connect real credentials and deploy the agent to use live AgentCore Browser sessions with DCV streaming.

## Key Integration Points

### Strands Agent with AgentCoreBrowser (Python)

```python
from strands import Agent
from strands_tools.browser import AgentCoreBrowser
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

@app.entrypoint
def handler(payload: dict) -> dict:
    browser_tool = AgentCoreBrowser(region="us-west-2")
    agent = Agent(tools=[browser_tool.browser])
    result = agent(payload["prompt"])
    return {"response": result.message["content"][0]["text"]}
```

### Browser Profiles for Persistent Sessions (Python)

```python
import boto3

control = boto3.client('bedrock-agentcore-control')
data = boto3.client('bedrock-agentcore')

# Create profile → login → save → reuse
profile = control.create_browser_profile(name="my-profile")
data.save_browser_session_profile(sessionId=sid, profileIdentifier=profile['profileId'])
data.start_browser_session(profileConfiguration={"profileIdentifier": profile['profileId']})
```

### DCV Live View in React (TypeScript)

```tsx
import { BrowserLiveView } from 'bedrock-agentcore/browser/live-view'

<BrowserLiveView signedUrl={presignedUrl} remoteWidth={1920} remoteHeight={1080} />
```

## References

- [AgentCore Browser Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html)
- [BrowserLiveView Blog Post](https://aws.amazon.com/blogs/machine-learning/embed-a-live-ai-browser-agent-in-your-react-app-with-amazon-bedrock-agentcore/)
- [Browser Profiles](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-profiles.html)
- [Strands Agents SDK](https://strandsagents.com/)
- [AgentCore Browser Quickstart](https://aws.github.io/bedrock-agentcore-starter-toolkit/user-guide/builtin-tools/quickstart-browser.html)
