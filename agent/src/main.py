"""
AgentCore Runtime agent with Browser tool.
Supports custom browser identifiers and browser profiles for persistent sessions.
"""

import os
import logging

os.environ["BYPASS_TOOL_CONSENT"] = "true"

from strands import Agent
from strands_tools.browser import AgentCoreBrowser
from bedrock_agentcore.runtime import BedrockAgentCoreApp

REGION = os.environ.get("AWS_REGION", "us-east-1")
DEFAULT_BROWSER_ID = os.environ.get("BROWSER_IDENTIFIER", "aws.browser.v1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a browser automation agent with access to a real Chrome browser via AgentCore Browser.

You can navigate websites, fill forms, click buttons, extract text, take screenshots, and perform any web interaction.

Guidelines:
- Navigate to URLs before trying to interact with page elements
- Read page content (getText) before making decisions about what to click or fill
- When logging in: fill username first, then password, then click the submit button
- Use waitForSelector before interacting with elements that may load asynchronously
- For web crawling: navigate to the page, extract relevant content, and summarize findings
- For authenticated sessions: check if already logged in before attempting login
- Always explain what you are doing and why in your responses
- Be methodical and thorough — verify each action succeeded before moving on
"""

app = BedrockAgentCoreApp()


@app.entrypoint
def handler(payload: dict) -> dict:
    prompt = payload.get("prompt", "")
    browser_identifier = payload.get("browser_identifier", DEFAULT_BROWSER_ID)
    profile_id = payload.get("profile_id")

    if not prompt:
        return {"error": "prompt is required", "status": "error"}

    logger.info(f"Prompt: {prompt[:100]}...")
    logger.info(f"Browser identifier: {browser_identifier}")
    if profile_id:
        logger.info(f"Profile ID: {profile_id}")

    try:
        browser_tool = AgentCoreBrowser(
            region=REGION,
            identifier=browser_identifier,
        )

        # If a profile_id is provided, patch create_browser_session to use it
        if profile_id:
            _patch_with_profile(browser_tool, profile_id)

        agent = Agent(
            system_prompt=SYSTEM_PROMPT,
            model=MODEL_ID,
            tools=[browser_tool.browser],
        )

        logger.info("Running browser agent...")
        result = agent(prompt)

        response_text = ""
        if result.message and result.message.get("content"):
            for block in result.message["content"]:
                if isinstance(block, dict) and block.get("text"):
                    response_text += block["text"]

        logger.info("Agent completed successfully")
        return {"status": "success", "response": response_text}

    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


def _patch_with_profile(browser_tool: AgentCoreBrowser, profile_id: str):
    """Patch AgentCoreBrowser.create_browser_session to start with a profile."""
    from bedrock_agentcore.tools.browser_client import BrowserClient

    original_create = browser_tool.create_browser_session

    async def patched_create():
        if not browser_tool._playwright:
            raise RuntimeError("Playwright not initialized")

        session_client = BrowserClient(region=browser_tool.region)
        session_id = session_client.start(
            identifier=browser_tool.identifier,
            session_timeout_seconds=browser_tool.session_timeout,
            profile_configuration={"profileIdentifier": profile_id},
        )
        logger.info(f"Started session with profile {profile_id}: {session_id}")

        cdp_url, cdp_headers = session_client.generate_ws_headers()
        browser = await browser_tool._playwright.chromium.connect_over_cdp(
            endpoint_url=cdp_url, headers=cdp_headers
        )
        return browser

    browser_tool.create_browser_session = patched_create
