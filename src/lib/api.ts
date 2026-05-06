/**
 * API client for the AgentCore Browser demo server.
 *
 * Frontend (Vite :5173) calls backend (Fastify :3001) directly — no proxy.
 * CORS is enabled on the backend via @fastify/cors.
 */

import type { AgentStep } from "../components/ActivityLog";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// When served via CloudFront, /api/* routes to the ALB (same origin).
// For local dev, fall back to port 3001.
const API_BASE =
  import.meta.env.DEV
    ? `http://${window.location.hostname}:3001`
    : "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoResponse {
  sessionId: string;
  liveViewUrl: string;
  liveViewEndpoint?: string;
  steps: AgentStep[];
  answer: string;
  agentMode?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  liveViewUrl: string;
  liveViewEndpoint?: string;
}

export interface RunAgentResponse {
  steps: AgentStep[];
  answer: string;
  agentMode?: string;
  agentSessionId?: string;
  agentLiveViewUrl?: string;
}

export interface BrowserSession {
  sessionId: string;
  browserIdentifier: string;
  automationEndpoint?: string;
  liveViewEndpoint?: string;
  status: string;
  startedAt: string;
}

export interface BrowserProfile {
  profileId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers — all requests go directly to API_BASE (port 3001)
// ---------------------------------------------------------------------------

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed: ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Two-phase demo endpoints (async with polling)
// ---------------------------------------------------------------------------

/** Phase 1: Start browser session (~2s). Returns live view URL immediately. */
export function startDemoSession(
  name?: string,
  profileId?: string,
  browserIdentifier?: string
): Promise<StartSessionResponse> {
  return post("/api/demos/start-session", { name, profileId, browserIdentifier });
}

/** Phase 2: Start the agent (returns jobId immediately, no timeout risk). */
export function startDemoAgent(
  prompt: string,
  sessionId?: string,
  profileId?: string,
  browserIdentifier?: string,
  action?: string
): Promise<{ jobId: string; status: string }> {
  return post("/api/demos/run-agent", { prompt, sessionId, profileId, browserIdentifier, action });
}

/** Poll for agent job results. */
export function pollAgentJob(jobId: string): Promise<{
  jobId: string;
  status: "running" | "completed" | "error";
  steps: AgentStep[];
  answer?: string;
  error?: string;
  agentMode?: string;
  agentSessionId?: string;
  agentLiveViewUrl?: string;
}> {
  return get(`/api/demos/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// Session endpoints
// ---------------------------------------------------------------------------

export function listSessions(): Promise<{ sessions: BrowserSession[] }> {
  return get("/api/sessions");
}

export function startSession(opts?: {
  name?: string;
  profileId?: string;
}): Promise<{ session: BrowserSession; liveViewUrl: string }> {
  return post("/api/sessions", opts ?? {});
}

export function stopSession(sessionId: string): Promise<{ status: string }> {
  return del(`/api/sessions/${sessionId}`);
}

export function getLiveViewUrl(
  sessionId: string
): Promise<{ liveViewUrl: string }> {
  return get(`/api/sessions/${sessionId}/live-view`);
}

// ---------------------------------------------------------------------------
// Profile endpoints
// ---------------------------------------------------------------------------

export function listProfilesApi(): Promise<{ profiles: BrowserProfile[] }> {
  return get("/api/profiles");
}

export function createProfileApi(name: string): Promise<{ profile: BrowserProfile }> {
  return post("/api/profiles", { name });
}

export function deleteProfileApi(profileId: string): Promise<{ status: string }> {
  return del(`/api/profiles/${profileId}`);
}

export function saveSessionToProfileApi(
  profileId: string,
  sessionId: string
): Promise<{ status: string }> {
  return post(`/api/profiles/${profileId}/save`, { sessionId });
}
