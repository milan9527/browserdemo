/**
 * Configuration and metadata for each demo scenario.
 */

export interface DemoConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  defaultPrompt: string;
  features: string[];
  promptOptions?: {
    label: string;
    description: string;
    prompt: string;
    browserIdentifier?: string;
    action?: string;
  }[];
  codeSnippets: {
    title: string;
    language: string;
    code: string;
  }[];
}

export const demoConfigs: Record<string, DemoConfig> = {
  "web-crawl": {
    id: "web-crawl",
    title: "Web Crawling",
    subtitle: "Crawl Internet data with a browser agent",
    icon: "🌐",
    description:
      "Compare how bot-protected websites respond to browser agents with and without Web Bot Auth. " +
      "Web Bot Auth cryptographically signs HTTP requests so WAF vendors (Cloudflare, Akamai, HUMAN Security) " +
      "can verify the agent's identity. Sites that allow verified bots will reduce CAPTCHAs.",
    defaultPrompt:
      "Navigate to https://medium.com and search for AWS topics. Read the top results and summarize the key findings.",
    features: [
      "Web Bot Auth (IETF draft)",
      "Cloudflare / Akamai / HUMAN",
      "Cryptographic request signing",
      "DCV Live View",
    ],
    promptOptions: [
      {
        label: "🚫 Without Web Bot Auth",
        description: "Standard browser — no signature headers added to requests",
        prompt: "",
        browserIdentifier: "public_browser-cFVHckg8Oi",
      },
      {
        label: "✅ With Web Bot Auth",
        description: "Adds Signature, Signature-Agent, Signature-Input headers to every HTTP request",
        prompt: "",
        browserIdentifier: "public_browser_webauth-piLpCAcEYA",
      },
    ],
    codeSnippets: [
      {
        title: "Strands agent with AgentCoreBrowser (agent/src/main.py)",
        language: "Python",
        code: `from strands import Agent
from strands_tools.browser import AgentCoreBrowser

# Initialize the AgentCore Browser tool
browser_tool = AgentCoreBrowser(
    region="us-west-2",
    identifier="aws.browser.v1"
)

# Create agent with browser tool
agent = Agent(
    system_prompt="You are a browser automation agent...",
    tools=[browser_tool.browser]
)

# Run — the agent navigates, extracts, summarizes
result = agent(
    "Navigate to Wikipedia and summarize the page"
)
print(result.message["content"][0]["text"])`,
      },
      {
        title: "Deploy to AgentCore Runtime",
        language: "bash",
        code: `# Configure and deploy the agent
cd agent/
agentcore configure --entrypoint src/main.py
agentcore launch

# Invoke the deployed agent
agentcore invoke '{"prompt": "Navigate to wikipedia.org..."}'`,
      },
      {
        title: "React: render DCV Live View",
        language: "TSX",
        code: `import { BrowserLiveView }
  from 'bedrock-agentcore/browser/live-view'

// signedUrl from browser.generateLiveViewUrl()
<BrowserLiveView
  signedUrl={presignedUrl}
  remoteWidth={1920}
  remoteHeight={1080}
/>`,
      },
    ],
  },

  "auth-login": {
    id: "auth-login",
    title: "Authenticated Login",
    subtitle: "User login with web bot authentication",
    icon: "🔐",
    description:
      "The Strands agent on AgentCore Runtime navigates to a login page, fills credentials, " +
      "submits the form, and performs authenticated actions. Every keystroke visible via DCV.",
    defaultPrompt:
      'Navigate to https://the-internet.herokuapp.com/login. ' +
      'Enter username "tomsmith" and password "SuperSecretPassword!" into the form fields. ' +
      "Click the Login button. After logging in, read the secure area page and confirm success.",
    features: [
      "Form filling via Playwright CDP",
      "Credential entry + submit",
      "Post-login navigation",
      "Real-time DCV observation",
    ],
    codeSnippets: [
      {
        title: "Agent handles login autonomously",
        language: "Python",
        code: `from strands import Agent
from strands_tools.browser import AgentCoreBrowser

browser_tool = AgentCoreBrowser(region="us-west-2")
agent = Agent(tools=[browser_tool.browser])

# The agent reasons about which browser actions to take:
# 1. navigate to login page
# 2. type username into #username field
# 3. type password into #password field
# 4. click the submit button
# 5. verify login success by reading page content
result = agent(
    'Log in to https://the-internet.herokuapp.com/login '
    'with username "tomsmith" and password "SuperSecretPassword!"'
)`,
      },
      {
        title: "Invoke via AgentCore Runtime API",
        language: "TypeScript",
        code: `// Server invokes the deployed Strands agent
const { stdout } = await execFile("agentcore", [
  "invoke",
  JSON.stringify({
    prompt: "Log in to the-internet.herokuapp.com...",
    session_config: {
      timeout_seconds: 900,
      viewport: { width: 1920, height: 1080 }
    }
  })
]);

const result = JSON.parse(stdout);
// result.response = "Successfully logged in..."
// result.session_info.session_id = "..."`,
      },
    ],
  },

  "persistent-session": {
    id: "persistent-session",
    title: "Persistent Session",
    subtitle: "Browser profile for session continuity",
    icon: "💾",
    description:
      "Browser profiles persist cookies and localStorage across sessions. " +
      "Step 1: Login and save the profile. Step 2: Start a new session with the saved profile — already logged in, no credentials needed.",
    defaultPrompt:
      'Navigate to https://the-internet.herokuapp.com/login, enter username "tomsmith" and password "SuperSecretPassword!", click Login, and confirm you are logged in.',
    features: [
      "Browser profiles API",
      "Persist cookies & localStorage",
      "Resume authenticated sessions",
      "No re-login needed",
    ],
    promptOptions: [
      {
        label: "1️⃣ Login & Save Profile",
        description: "Login to the site and save cookies to a browser profile",
        prompt:
          'Navigate to https://the-internet.herokuapp.com/login, enter username "tomsmith" and password "SuperSecretPassword!", click Login, and confirm you are logged in.',
        action: "login-and-save",
      },
      {
        label: "2️⃣ Resume with Profile",
        description: "Start a new session with the saved profile — already logged in without credentials",
        prompt:
          "Navigate to https://the-internet.herokuapp.com/secure and check if you are already logged in. Report what you see.",
        action: "resume-with-profile",
      },
    ],
    codeSnippets: [
      {
        title: "1. Create a browser profile",
        language: "Python",
        code: `import boto3

control = boto3.client(
    'bedrock-agentcore-control',
    region_name='us-west-2'
)

profile = control.create_browser_profile(
    name="my-auth-profile"
)
profile_id = profile['profileId']`,
      },
      {
        title: "2. Login & save session to profile",
        language: "Python",
        code: `data = boto3.client(
    'bedrock-agentcore',
    region_name='us-west-2'
)

# Start session, agent logs in...
# Then save cookies & localStorage to profile
data.save_browser_session_profile(
    sessionId=session['sessionId'],
    browserIdentifier="aws.browser.v1",
    profileIdentifier=profile_id
)`,
      },
      {
        title: "3. Start new session with saved profile",
        language: "Python",
        code: `# New session restores auth state automatically
session2 = data.start_browser_session(
    browserIdentifier="aws.browser.v1",
    name="resumed-session",
    profileConfiguration={
        "profileIdentifier": profile_id
    }
)
# Agent is already logged in — no re-authentication`,
      },
      {
        title: "4. Agent verifies persistent session",
        language: "Python",
        code: `from strands import Agent
from strands_tools.browser import AgentCoreBrowser

browser_tool = AgentCoreBrowser(
    region="us-west-2",
    identifier="aws.browser.v1"
)
agent = Agent(tools=[browser_tool.browser])

# Agent checks if already authenticated
result = agent(
    "Navigate to the secure area and verify "
    "the session is still authenticated"
)`,
      },
    ],
  },

  custom: {
    id: "custom",
    title: "Custom Agent",
    subtitle: "Free-form browser automation",
    icon: "🤖",
    description:
      "Send any prompt to the Strands agent on AgentCore Runtime. It reasons about " +
      "which browser tools to use and executes them while you watch via DCV Live View.",
    defaultPrompt: "",
    features: [
      "Any website navigation",
      "Form interaction",
      "Data extraction",
      "Multi-step workflows",
    ],
    codeSnippets: [
      {
        title: "End-to-end architecture",
        language: "TypeScript",
        code: `// 1. React frontend sends prompt to Fastify server
//    POST /api/demos/custom { prompt: "..." }

// 2. Server starts AgentCore Browser session
const session = await startSession({
  viewport: { width: 1920, height: 1080 }
})
const liveViewUrl = await generateLiveViewUrl(
  session.sessionId
)

// 3. Server invokes Strands agent on AgentCore Runtime
//    Agent uses AgentCoreBrowser → Playwright CDP
const result = await agentcore.invoke({
  prompt: userPrompt
})

// 4. DCV stream flows directly AWS → client browser
//    No video passes through the server
<BrowserLiveView signedUrl={liveViewUrl} />`,
      },
      {
        title: "Strands agent entrypoint (agent/src/main.py)",
        language: "Python",
        code: `from strands import Agent
from strands_tools.browser import AgentCoreBrowser
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

@app.entrypoint
def handler(payload: dict) -> dict:
    browser_tool = AgentCoreBrowser(
        region="us-west-2",
        identifier="aws.browser.v1"
    )
    agent = Agent(
        system_prompt="You are a browser agent...",
        tools=[browser_tool.browser]
    )
    result = agent(payload["prompt"])
    return {
        "response": result.message["content"][0]["text"]
    }`,
      },
    ],
  },
};
