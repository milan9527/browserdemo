/**
 * Demo scenario routes — async agent invocation.
 *
 * Phase 1: POST /api/demos/start-session  → starts browser session (~2s)
 * Phase 2: POST /api/demos/run-agent      → starts agent async, returns jobId
 * Poll:    GET  /api/demos/jobs/:jobId    → returns job status + results
 */

import type { FastifyInstance } from "fastify";
import {
  startSession,
  generateLiveViewUrl,
  listBrowserSessions,
  generateLiveViewUrlForSession,
} from "../lib/agentcore-browser.js";
import { runBrowserAgent, type AgentStep } from "../lib/browser-agent.js";

// ---------------------------------------------------------------------------
// In-memory job store
// ---------------------------------------------------------------------------

export interface AgentJob {
  id: string;
  status: "running" | "completed" | "error";
  steps: AgentStep[];
  answer?: string;
  error?: string;
  agentMode?: string;
  agentSessionId?: string;
  agentLiveViewUrl?: string;
  startedAt: string;
  completedAt?: string;
}

export const jobs = new Map<string, AgentJob>();

function generateJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerDemoRoutes(server: FastifyInstance) {
  server.addHook("onRequest", async (req) => {
    if (req.url.startsWith("/api/demos/")) {
      req.socket.setTimeout(300_000);
    }
  });

  /**
   * Phase 1: Start a browser session and return the live view URL.
   */
  server.post<{ Body: { name?: string; profileId?: string; browserIdentifier?: string } }>(
    "/api/demos/start-session",
    async (req) => {
      const session = await startSession({
        name: req.body.name ?? `demo-${Date.now()}`,
        profileId: req.body.profileId,
        browserIdentifier: req.body.browserIdentifier,
      });
      const liveViewUrl = await generateLiveViewUrl(session.sessionId);
      return {
        sessionId: session.sessionId,
        liveViewUrl,
        liveViewEndpoint: session.liveViewEndpoint,
      };
    }
  );

  /**
   * Phase 2: Start the agent asynchronously. Returns a jobId immediately.
   */
  server.post<{ Body: { prompt: string; sessionId?: string; profileId?: string; browserIdentifier?: string; action?: string } }>(
    "/api/demos/run-agent",
    async (req) => {
      if (!req.body.prompt) {
        throw { statusCode: 400, message: "prompt is required" };
      }

      const jobId = generateJobId();
      const job: AgentJob = {
        id: jobId,
        status: "running",
        steps: [],
        startedAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);

      // Handle persistent session actions
      const action = req.body.action;
      let prompt = req.body.prompt;
      let profileId = req.body.profileId;

      if (action === "login-and-save") {
        // Append instruction to save profile after login
        prompt += '\n\nAfter successfully logging in, confirm you are on the secure page.';
        // We'll save the profile after the agent completes (in runAgentAsync)
      } else if (action === "resume-with-profile") {
        // Use the demo profile — resolve the actual profile ID
        try {
          const { ensureDemoProfile } = await import("../lib/agentcore-browser.js");
          profileId = await ensureDemoProfile();
        } catch {
          profileId = undefined;
        }
        prompt = 'Navigate to https://the-internet.herokuapp.com/secure and check if you are already logged in. Report what you see on the page.';
      }

      runAgentAsync(job, prompt, profileId, req.body.sessionId, req.body.browserIdentifier, action);

      return { jobId, status: "running" };
    }
  );

  /**
   * Poll for job status and results.
   */
  server.get<{ Params: { jobId: string } }>(
    "/api/demos/jobs/:jobId",
    async (req, reply) => {
      const job = jobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }
      return {
        jobId: job.id,
        status: job.status,
        steps: job.steps,
        answer: job.answer,
        error: job.error,
        agentMode: job.agentMode,
        agentSessionId: job.agentSessionId,
        agentLiveViewUrl: job.agentLiveViewUrl,
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Background agent runner
// ---------------------------------------------------------------------------

async function runAgentAsync(
  job: AgentJob,
  prompt: string,
  profileId?: string,
  sessionId?: string,
  browserIdentifier?: string,
  action?: string
) {
  try {
    // Poll CloudWatch logs for the agent's browser session ID in the background
    const logGroup = "/aws/bedrock-agentcore/runtimes/agentcorebrowserdemo-4TYLmV710D-DEFAULT";
    const pollStartTime = Date.now();
    
    const sessionPollInterval = setInterval(async () => {
      if (job.agentSessionId) return;
      try {
        const { CloudWatchLogsClient, FilterLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
        const cwl = new CloudWatchLogsClient({ region: process.env.AWS_REGION ?? "us-east-1" });
        const res = await cwl.send(new FilterLogEventsCommand({
          logGroupName: logGroup,
          filterPattern: "Session started",
          startTime: pollStartTime,
          limit: 5,
        }));
        for (const event of res.events ?? []) {
          const match = event.message?.match(/Session started:\s*(\S+)/);
          if (match) {
            const browserSessionId = match[1];
            console.log(`[job ${job.id}] Found browser session from logs: ${browserSessionId}`);
            job.agentSessionId = browserSessionId;
            job.agentLiveViewUrl = await generateLiveViewUrlForSession(browserSessionId, browserIdentifier);
            console.log(`[job ${job.id}] Live view URL generated for ${browserIdentifier ?? 'default'}`);
            return;
          }
        }
      } catch (e: any) {
        // Try alternative log pattern
        try {
          const { CloudWatchLogsClient, FilterLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
          const cwl = new CloudWatchLogsClient({ region: process.env.AWS_REGION ?? "us-east-1" });
          const res = await cwl.send(new FilterLogEventsCommand({
            logGroupName: logGroup,
            filterPattern: "started Bedrock AgentCore browser session",
            startTime: pollStartTime,
            limit: 5,
          }));
          for (const event of res.events ?? []) {
            const match = event.message?.match(/browser session:\s*(\S+)/);
            if (match) {
              job.agentSessionId = match[1];
              job.agentLiveViewUrl = await generateLiveViewUrlForSession(match[1], browserIdentifier);
              return;
            }
          }
        } catch {}
      }
    }, 3000);

    const answer = await runBrowserAgent(
      prompt,
      (step) => job.steps.push(step),
      { profileId, sessionId, browserIdentifier }
    );

    clearInterval(sessionPollInterval);

    job.answer = answer;
    job.agentMode = process.env.AGENT_MODE ?? "runtime";
    job.status = "completed";
    job.completedAt = new Date().toISOString();

    // For "login-and-save" action, save the browser session to a profile
    if (action === "login-and-save" && job.agentSessionId) {
      try {
        const { ensureDemoProfile, saveSessionProfile } = await import("../lib/agentcore-browser.js");
        const profileIdentifier = await ensureDemoProfile();
        await saveSessionProfile(job.agentSessionId, profileIdentifier, browserIdentifier);
        job.answer = (job.answer ?? "") + "\n\n✅ Browser profile saved! Cookies and localStorage persisted. Click '2️⃣ Resume with Profile' to start a new session with the saved auth state.";
      } catch (e: any) {
        job.answer = (job.answer ?? "") + `\n\n⚠️ Profile save failed: ${e.message}`;
      }
    }

    // Terminate the browser session after a short delay (let frontend see final state)
    if (job.agentSessionId) {
      setTimeout(async () => {
        try {
          const { stopBrowserSession } = await import("../lib/agentcore-browser.js");
          await stopBrowserSession(job.agentSessionId!, browserIdentifier);
        } catch {
          // Session may already be terminated by the agent
        }
      }, 30_000); // 30s delay so user can see the final page
    }
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : String(err);
    job.completedAt = new Date().toISOString();
  }
}
