# AgentCore Browser Demo — DCV Live View

A demo platform showcasing **Amazon Bedrock AgentCore Browser** with **DCV Live View** streaming and **Web Bot Auth** comparison. A Strands agent deployed on AgentCore Runtime uses `AgentCoreBrowser` to navigate websites — visible in real time through the DCV protocol embedded in a React app.

## Live Demo

**https://d319md4f6odh3i.cloudfront.net**

## Architecture

```
┌─────────────────┐     HTTPS     ┌──────────────────┐                    ┌──────────────────┐
│  React Frontend │◄────────────►│  CloudFront       │                    │  AgentCore       │
│  (S3 + OAC)    │              │  /api/* → ALB     │                    │  Runtime         │
│                 │              │  /* → S3          │                    │  ┌────────────┐  │
│  BrowserLive   │              ├──────────────────┤  agentcore invoke  │  │ Strands    │  │
│  View (DCV)    │              │  Fastify Server   │◄────────────────►│  │ Agent      │  │
│                 │              │  (ECS Fargate)    │                    │  │ + Browser  │  │
│  Activity Log  │              └───────────────────┘                    │  └─────┬──────┘  │
└────────┬────────┘                                                     └────────┼─────────┘
         │              DCV WebSocket (direct)                                   │
         │                                                       Playwright CDP  │
         │                                                              ┌────────▼─────────┐
         └─────────────────────────────────────────────────────────────►│  AgentCore       │
                                                                        │  Browser         │
                                                                        │  (Chrome)        │
                                                                        └──────────────────┘
```

## Key Features

- **DCV Live View** — watch the AI agent navigate websites in real time via embedded DCV stream
- **Web Bot Auth comparison** — compare browser behavior with and without IETF Web Bot Auth protocol
- **Async agent invocation** — non-blocking polling pattern avoids CloudFront timeout limits
- **Session detection** — automatically discovers the agent's browser session via CloudWatch logs
- **S3 + CloudFront with OAC** — private S3 bucket, no public access, CloudFront Origin Access Control

## Demo Scenarios

| Demo | Description |
|------|-------------|
| 🌐 **Web Crawl** | Compare Web Bot Auth enabled vs disabled on bot-protected sites (e.g. LinkedIn) |
| 🔐 **Auth Login** | Agent fills login forms, submits credentials, performs authenticated actions |
| 💾 **Persistent Session** | Browser profiles persist cookies/localStorage across sessions |
| 🤖 **Custom Agent** | Free-form prompt to the Strands agent with AgentCoreBrowser |

## Web Bot Auth

The Web Crawl demo compares two AgentCore Browser configurations:

- **Without Web Bot Auth** (`public_browser-cFVHckg8Oi`) — standard browser, no request signing
- **With Web Bot Auth** (`public_browser_webauth-piLpCAcEYA`) — cryptographically signs HTTP requests using the [IETF Web Bot Auth protocol](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-web-bot-auth.html)

Web Bot Auth works with sites protected by Cloudflare, Akamai, HUMAN Security, and DataDome. Domain owners control whether signed bots are allowed.

## Prerequisites

- **Node.js 20+**
- **Python 3.10+**
- **Docker** — for building the ECS container
- **AWS CLI v2** — configured with appropriate permissions
- **AgentCore CLI** — `pip install bedrock-agentcore-starter-toolkit`
- **Bedrock model access** — Claude Sonnet or similar

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Set AWS credentials
export AWS_REGION=us-east-1

# Start dev servers (Vite + Fastify)
AGENT_MODE=runtime npm run dev

# Open http://localhost:5173
```

## Deploy to AWS

The `deploy.sh` script creates all infrastructure using AWS CLI:

```bash
# First deploy (creates VPC, ALB, ECS, S3, CloudFront)
./deploy.sh

# Subsequent deploys (rebuilds and pushes only)
./redeploy.sh
```

### Infrastructure Created

| Resource | Purpose |
|----------|---------|
| S3 Bucket | Frontend static files (private, CloudFront OAC only) |
| CloudFront | CDN with SPA routing + `/api/*` → ALB |
| CloudFront Function | SPA router + DCV SDK path rewriting |
| ALB | Load balancer for ECS backend |
| ECS Fargate (ARM64) | Fastify API server |
| ECR | Docker image repository |
| VPC + Subnets | Network for ECS/ALB |
| CloudWatch Logs | ECS container logs + agent session detection |

### Deploy the Strands Agent

```bash
cd agent/
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# Deploy to AgentCore Runtime
agentcore configure --entrypoint src/main.py --non-interactive
agentcore deploy
```

## Project Structure

```
├── agent/                         # Python Strands agent (AgentCore Runtime)
│   ├── src/main.py                # Agent entrypoint — accepts browser_identifier
│   ├── .bedrock_agentcore.yaml    # AgentCore Runtime config
│   └── pyproject.toml
├── server/                        # Fastify backend (ECS Fargate)
│   ├── index.ts                   # Server entry point
│   ├── lib/
│   │   ├── agentcore-browser.ts   # Browser SDK wrapper + SigV4 presigning
│   │   └── browser-agent.ts       # Agent invoker (runtime/local/direct modes)
│   └── routes/
│       ├── demos.ts               # Async agent jobs + CloudWatch session detection
│       ├── sessions.ts            # Session management
│       └── profiles.ts            # Browser profile management
├── src/                           # React frontend (S3 + CloudFront)
│   ├── components/
│   │   ├── LiveViewPanel.tsx      # DCV live view with fullscreen
│   │   ├── ActivityLog.tsx        # Agent step timeline
│   │   └── PromptInput.tsx        # Prompt input + Web Bot Auth option buttons
│   ├── pages/
│   │   └── DemoPage.tsx           # Main demo view (browser left, log right)
│   └── lib/
│       ├── api.ts                 # API client with async polling
│       └── demo-configs.ts        # Demo metadata + browser identifiers
├── public/
│   └── dcv-viewer.html            # Standalone DCV viewer (fallback)
├── Dockerfile                     # ECS container (Node + Python + agentcore CLI)
├── deploy.sh                      # Full infrastructure deploy (AWS CLI)
├── redeploy.sh                    # Quick code-only redeploy
└── vite.config.ts                 # Vite config with DCV SDK aliases
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region |
| `BROWSER_IDENTIFIER` | `aws.browser.v1` | Default browser tool identifier |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Model for the agent |
| `AGENT_MODE` | `runtime` | Agent invocation mode: `runtime`, `local`, `direct` |

## How It Works

1. **User clicks a demo button** → frontend calls `POST /api/demos/run-agent` with prompt + browserIdentifier
2. **Server starts agent async** → returns jobId immediately (avoids CloudFront 60s timeout)
3. **Agent runs on AgentCore Runtime** → creates browser session, navigates with Playwright CDP
4. **Server polls CloudWatch logs** → detects agent's browser session ID
5. **Server generates presigned live view URL** → SigV4-signed DCV endpoint for the agent's session
6. **Frontend polls job status** → receives live view URL, renders DCV stream via BrowserLiveView
7. **DCV stream flows directly** → AWS → browser (no video through the server)
8. **Session cleanup** → browser session terminated 30s after agent completes

## References

- [AgentCore Browser Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html)
- [Web Bot Auth](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-web-bot-auth.html)
- [BrowserLiveView Blog Post](https://aws.amazon.com/blogs/machine-learning/embed-a-live-ai-browser-agent-in-your-react-app-with-amazon-bedrock-agentcore/)
- [Strands Agents SDK](https://strandsagents.com/)
