/**
 * Browser Agent — invokes the Strands agent deployed on AgentCore Runtime.
 *
 * The agent (agent/src/main.py) uses strands_tools.browser.AgentCoreBrowser
 * to drive a real Chrome browser via AgentCore Browser. This module invokes
 * that agent through the AgentCore Runtime API.
 *
 * Two modes:
 *   1. RUNTIME mode  — calls the deployed agent via `agentcore invoke`
 *   2. LOCAL mode     — calls the local dev server at localhost:8080
 *   3. DIRECT mode    — runs the Bedrock Converse loop directly (fallback)
 *
 * Set AGENT_MODE=runtime|local|direct via environment variable.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStep {
  timestamp: string;
  type: "tool_call" | "tool_result" | "thinking" | "answer";
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  text?: string;
}

export type OnStepCallback = (step: AgentStep) => void;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AGENT_MODE = process.env.AGENT_MODE ?? "runtime"; // runtime | local | direct
const AGENT_PORT = process.env.AGENT_PORT ?? "8080";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-20250514-v1:0";

// ---------------------------------------------------------------------------
// Runtime mode — invoke deployed agent via agentcore CLI
// ---------------------------------------------------------------------------

async function invokeRuntime(
  prompt: string,
  profileId?: string,
  sessionId?: string,
  browserIdentifier?: string
): Promise<{ response: string; sessionInfo?: Record<string, string> }> {
  const payload = JSON.stringify({
    prompt,
    session_id: sessionId,
    profile_id: profileId,
    browser_identifier: browserIdentifier,
    session_config: {
      timeout_seconds: 900,
      viewport: { width: 1920, height: 1080 },
    },
  });

  // Use the venv agentcore CLI, fall back to PATH
  const agentcoreBin =
    process.env.AGENTCORE_BIN ?? ".venv/bin/agentcore";

  const { stdout } = await execFileAsync(agentcoreBin, [
    "invoke",
    payload,
  ], {
    env: { ...process.env, AWS_REGION: process.env.AWS_REGION ?? "us-east-1" },
    cwd: process.env.AGENT_DIR ?? "agent",
    timeout: 300_000, // 5 min max
  });

  // agentcore invoke returns a decorated box + "Response:" section
  // Try JSON first, then fall back to text extraction
  const jsonMatch = stdout.match(/\{[\s\S]*"response"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      return {
        response: result.response ?? result.text ?? stdout.trim(),
        sessionInfo: result.session_info,
      };
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Extract the text after "Response:" (CLI text format)
  const responseMatch = stdout.match(/Response:\s*\n([\s\S]*)/);
  const responseText = responseMatch
    ? responseMatch[1].trim()
    : stdout.replace(/╭[\s\S]*?╯\s*/g, "").trim(); // Strip the box

  return { response: responseText };
}

// ---------------------------------------------------------------------------
// Local dev mode — POST to local agentcore dev server
// ---------------------------------------------------------------------------

async function invokeLocal(
  prompt: string,
  profileId?: string
): Promise<{ response: string; sessionInfo?: Record<string, string> }> {
  const payload = {
    prompt,
    profile_id: profileId,
    session_config: {
      timeout_seconds: 900,
      viewport: { width: 1920, height: 1080 },
    },
  };

  const res = await fetch(`http://localhost:${AGENT_PORT}/invocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Agent dev server returned ${res.status}: ${await res.text()}`);
  }

  const result = await res.json() as Record<string, unknown>;
  return {
    response: (result.response ?? result.text ?? "") as string,
    sessionInfo: result.session_info as Record<string, string> | undefined,
  };
}

// ---------------------------------------------------------------------------
// Direct mode — Bedrock Converse loop with simulated browser tools (fallback)
// ---------------------------------------------------------------------------

const browserToolDefs = [
  {
    toolSpec: {
      name: "navigate",
      description: "Navigate the browser to a URL",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to navigate to" },
          },
          required: ["url"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "click",
      description: "Click an element on the page identified by a CSS selector",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector of the element to click",
            },
          },
          required: ["selector"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "type",
      description:
        "Type text into an input element identified by a CSS selector",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector of the input element",
            },
            text: { type: "string", description: "Text to type" },
          },
          required: ["selector", "text"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "getText",
      description:
        "Get the visible text content of the page or a specific element",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description:
                "Optional CSS selector. If omitted, returns full page text.",
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "screenshot",
      description:
        "Take a screenshot of the current page. Returns a base64-encoded PNG.",
      inputSchema: {
        json: { type: "object", properties: {} },
      },
    },
  },
  {
    toolSpec: {
      name: "pressKey",
      description: "Press a keyboard key (e.g. Enter, Tab, Escape)",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            key: { type: "string", description: "Key to press" },
          },
          required: ["key"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "scroll",
      description: "Scroll the page by a given amount",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: ["up", "down"],
              description: "Scroll direction",
            },
            amount: {
              type: "number",
              description: "Pixels to scroll (default 500)",
            },
          },
          required: ["direction"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "waitForSelector",
      description:
        "Wait for an element matching a CSS selector to appear on the page",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector to wait for",
            },
            timeout: {
              type: "number",
              description: "Max wait time in ms (default 5000)",
            },
          },
          required: ["selector"],
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a browser automation agent. You can interact with web pages using the provided browser tools.

Guidelines:
- Use navigate to go to URLs
- Use getText to read page content before making decisions
- Use click and type to interact with forms and buttons
- Use waitForSelector before interacting with elements that may not be loaded yet
- Use screenshot when you need visual confirmation
- Be methodical: navigate first, read the page, then interact
- When logging in, fill username first, then password, then click submit
- For web crawling, extract the relevant data and summarize it
- Always explain what you are doing and why`;

function executeBrowserToolStub(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "navigate":
      return `Navigated to ${input.url}`;
    case "click":
      return `Clicked element: ${input.selector}`;
    case "type":
      return `Typed "${input.text}" into ${input.selector}`;
    case "getText":
      return `[Page text content extracted from ${input.selector ?? "full page"}]`;
    case "screenshot":
      return "[base64-encoded screenshot PNG]";
    case "pressKey":
      return `Pressed key: ${input.key}`;
    case "scroll":
      return `Scrolled ${input.direction} by ${input.amount ?? 500}px`;
    case "waitForSelector":
      return `Element ${input.selector} found`;
    default:
      return `Unknown tool: ${name}`;
  }
}

async function invokeDirect(
  prompt: string,
  onStep: OnStepCallback
): Promise<string> {
  const bedrockClient = new BedrockRuntimeClient({ region: REGION });
  const messages: any[] = [{ role: "user", content: [{ text: prompt }] }];
  const MAX_STEPS = 25;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: { tools: browserToolDefs as any },
      })
    );

    const output = response.output as any;
    const stopReason = response.stopReason;
    const assistantContent = output?.message?.content ?? [];
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: any[] = [];

    for (const block of assistantContent) {
      if (block.text) {
        onStep({
          timestamp: new Date().toISOString(),
          type: stopReason === "tool_use" ? "thinking" : "answer",
          text: block.text,
        });
      }

      if (block.toolUse) {
        const { toolUseId, name, input } = block.toolUse;

        onStep({
          timestamp: new Date().toISOString(),
          type: "tool_call",
          tool: name,
          input: input as Record<string, unknown>,
        });

        const result = executeBrowserToolStub(
          name,
          input as Record<string, unknown>
        );

        onStep({
          timestamp: new Date().toISOString(),
          type: "tool_result",
          tool: name,
          output: result,
        });

        toolResults.push({
          toolResult: { toolUseId, content: [{ text: result }] },
        });
      }
    }

    if (stopReason === "tool_use" && toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return (
      assistantContent
        .filter((b: any) => b.text)
        .map((b: any) => b.text)
        .join("\n") || "Agent completed without a text response."
    );
  }

  return "Agent reached maximum steps without a final answer.";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the browser agent for a given prompt.
 *
 * In runtime/local mode, the agent runs on AgentCore Runtime with a real
 * browser. In direct mode, it falls back to the Bedrock Converse loop.
 */
export async function runBrowserAgent(
  prompt: string,
  onStep: OnStepCallback,
  opts?: { profileId?: string; sessionId?: string; browserIdentifier?: string }
): Promise<string> {
  onStep({
    timestamp: new Date().toISOString(),
    type: "thinking",
    text: `Agent mode: ${AGENT_MODE} — ${
      AGENT_MODE === "runtime"
        ? "invoking deployed agent on AgentCore Runtime"
        : AGENT_MODE === "local"
          ? `calling local dev server on port ${AGENT_PORT}`
          : "running Bedrock Converse loop directly"
    }`,
  });

  if (AGENT_MODE === "direct") {
    return invokeDirect(prompt, onStep);
  }

  // Runtime or local mode — invoke the Strands agent
  onStep({
    timestamp: new Date().toISOString(),
    type: "thinking",
    text: "Sending prompt to Strands agent with AgentCoreBrowser tool...",
  });

  try {
    const invoker =
      AGENT_MODE === "local" ? invokeLocal : invokeRuntime;
    const result = await invoker(prompt, opts?.profileId, opts?.sessionId, opts?.browserIdentifier);

    // Report session info if available
    if (result.sessionInfo) {
      onStep({
        timestamp: new Date().toISOString(),
        type: "tool_result",
        tool: "AgentCoreBrowser",
        output: `Browser session: ${JSON.stringify(result.sessionInfo)}`,
      });
    }

    onStep({
      timestamp: new Date().toISOString(),
      type: "answer",
      text: result.response,
    });

    return result.response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    onStep({
      timestamp: new Date().toISOString(),
      type: "tool_result",
      tool: "AgentCoreBrowser",
      output: `Error: ${message}`,
    });

    // Fall back to direct mode
    onStep({
      timestamp: new Date().toISOString(),
      type: "thinking",
      text: "Falling back to direct Bedrock Converse mode...",
    });

    return invokeDirect(prompt, onStep);
  }
}
