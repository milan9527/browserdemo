/**
 * AgentCore Browser service — uses the bedrock-agentcore TypeScript SDK (v0.2.2)
 * for session management, live view URL generation, and browser profiles.
 *
 * Key SDK methods used:
 *   - Browser.startSession()        → create a browser session
 *   - Browser.getSession()          → get session details + stream endpoints
 *   - Browser.generateLiveViewUrl() → SigV4-presigned DCV live view URL
 *   - Browser.stopSession()         → terminate a session
 */

import { Browser } from "bedrock-agentcore/browser";
import {
  BedrockAgentCoreClient,
  ListBrowserSessionsCommand,
  SaveBrowserSessionProfileCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  BedrockAgentCoreControlClient,
  CreateBrowserProfileCommand,
  ListBrowserProfilesCommand,
  DeleteBrowserProfileCommand,
  GetBrowserProfileCommand,
} from "@aws-sdk/client-bedrock-agentcore-control";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserSessionInfo {
  sessionId: string;
  browserIdentifier: string;
  automationEndpoint?: string;
  liveViewEndpoint?: string;
  liveViewSignedUrl?: string;
  status: string;
  startedAt: string;
}

export interface BrowserProfileInfo {
  profileId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// In-memory stores (demo only)
// ---------------------------------------------------------------------------

const activeSessions = new Map<string, BrowserSessionInfo>();
const browserInstances = new Map<string, Browser>();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const region = process.env.AWS_REGION ?? "us-east-1";
const BROWSER_ID = process.env.BROWSER_IDENTIFIER ?? "aws.browser.v1";

const dataClient = new BedrockAgentCoreClient({ region });
const controlClient = new BedrockAgentCoreControlClient({ region });

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function startSession(opts?: {
  name?: string;
  profileId?: string;
  timeoutSeconds?: number;
  viewport?: { width: number; height: number };
  browserIdentifier?: string;
}): Promise<BrowserSessionInfo> {
  const bid = opts?.browserIdentifier ?? BROWSER_ID;
  const browser = new Browser({
    region,
    identifier: bid,
  });

  // Start the session
  const session = await browser.startSession({
    sessionName: opts?.name ?? `demo-${Date.now()}`,
    timeout: opts?.timeoutSeconds ?? 900,
    viewport: opts?.viewport ?? { width: 1920, height: 1080 },
  });

  // Get full session details including stream endpoints
  const details = await browser.getSession({ sessionId: session.sessionId });

  // Generate the SigV4-presigned live view URL using the SDK
  let liveViewSignedUrl: string | undefined;
  try {
    liveViewSignedUrl = await browser.generateLiveViewUrl(300);
  } catch (err) {
    console.warn("Failed to generate live view URL:", err);
  }

  const info: BrowserSessionInfo = {
    sessionId: session.sessionId,
    browserIdentifier: bid,
    automationEndpoint: details.streams?.automationStream?.streamEndpoint,
    liveViewEndpoint: details.streams?.liveViewStream?.streamEndpoint,
    liveViewSignedUrl,
    status: details.status ?? "READY",
    startedAt: new Date().toISOString(),
  };

  activeSessions.set(info.sessionId, info);
  browserInstances.set(info.sessionId, browser);

  return info;
}

export async function stopSession(sessionId: string): Promise<void> {
  const browser = browserInstances.get(sessionId);
  if (browser) {
    try {
      await browser.stopSession();
    } catch {
      // Session may already be terminated
    }
    browserInstances.delete(sessionId);
  }
  activeSessions.delete(sessionId);
}

export function getActiveSession(
  sessionId: string
): BrowserSessionInfo | undefined {
  return activeSessions.get(sessionId);
}

export function listActiveSessions(): BrowserSessionInfo[] {
  return Array.from(activeSessions.values());
}

// ---------------------------------------------------------------------------
// Live View URL
// ---------------------------------------------------------------------------

export async function generateLiveViewUrl(sessionId: string): Promise<string> {
  // First check our own sessions
  const session = activeSessions.get(sessionId);
  const browser = browserInstances.get(sessionId);
  if (browser) {
    const url = await browser.generateLiveViewUrl(300);
    if (session) session.liveViewSignedUrl = url;
    return url;
  }

  if (session?.liveViewSignedUrl) {
    return session.liveViewSignedUrl;
  }

  // For external sessions (created by the agent), create a Browser instance
  // and generate the live view URL
  const externalBrowser = new Browser({
    region,
    identifier: BROWSER_ID,
  });
  // Connect to the existing session
  await externalBrowser.getSession({ sessionId });
  const url = await externalBrowser.generateLiveViewUrl(300);
  // Cache it
  browserInstances.set(sessionId, externalBrowser);
  activeSessions.set(sessionId, {
    sessionId,
    browserIdentifier: BROWSER_ID,
    liveViewSignedUrl: url,
    status: "READY",
    startedAt: new Date().toISOString(),
  });
  return url;
}

// ---------------------------------------------------------------------------
// Browser profiles
// ---------------------------------------------------------------------------

export async function createProfile(
  name: string
): Promise<BrowserProfileInfo> {
  const res = await controlClient.send(
    new CreateBrowserProfileCommand({ name } as any)
  );
  return {
    profileId: (res as any).profileId,
    name,
    createdAt: new Date().toISOString(),
  };
}

export async function listProfiles(): Promise<BrowserProfileInfo[]> {
  const res = await controlClient.send(
    new ListBrowserProfilesCommand({} as any)
  );
  return ((res as any).browserProfiles ?? []).map((p: any) => ({
    profileId: p.profileId,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export async function getProfile(
  profileId: string
): Promise<BrowserProfileInfo> {
  const res = await controlClient.send(
    new GetBrowserProfileCommand({ profileId } as any)
  );
  return {
    profileId: (res as any).profileId,
    name: (res as any).name,
    createdAt: (res as any).createdAt,
    updatedAt: (res as any).updatedAt,
  };
}

export async function deleteProfile(profileId: string): Promise<void> {
  await controlClient.send(
    new DeleteBrowserProfileCommand({ profileId } as any)
  );
}

export async function saveSessionToProfile(
  sessionId: string,
  profileId: string
): Promise<void> {
  await dataClient.send(
    new SaveBrowserSessionProfileCommand({
      sessionId,
      browserIdentifier: BROWSER_ID,
      profileIdentifier: profileId,
    } as any)
  );
}


// ---------------------------------------------------------------------------
// List all browser sessions (for detecting agent-created sessions)
// ---------------------------------------------------------------------------

export async function listBrowserSessions(browserIdentifier?: string): Promise<
  { sessionId: string; status: string; name?: string; createdAt?: string; browserIdentifier?: string }[]
> {
  // Search across all known browser identifiers
  const identifiers = browserIdentifier
    ? [browserIdentifier]
    : [BROWSER_ID, "public_browser-cFVHckg8Oi", "public_browser_webauth-piLpCAcEYA"];

  const allSessions: { sessionId: string; status: string; name?: string; createdAt?: string; browserIdentifier?: string }[] = [];

  for (const bid of identifiers) {
    try {
      const res = await dataClient.send(
        new ListBrowserSessionsCommand({
          browserIdentifier: bid,
        } as any)
      );
      const sessions = ((res as any).items ?? [])
        .filter((s: any) => s.status === "READY" || s.status === "ACTIVE")
        .map((s: any) => ({
          sessionId: s.sessionId,
          status: s.status,
          name: s.name,
          createdAt: s.createdAt,
          browserIdentifier: bid,
        }));
      allSessions.push(...sessions);
    } catch {
      // Skip identifiers that fail
    }
  }

  return allSessions;
}

// ---------------------------------------------------------------------------
// Generate live view URL for any session (including agent-created ones)
// Uses SigV4 presigning directly — works for sessions created by any IAM principal
// ---------------------------------------------------------------------------

export async function generateLiveViewUrlForSession(
  sessionId: string,
  browserIdentifier?: string
): Promise<string> {
  const { SignatureV4 } = await import("@smithy/signature-v4");
  const { Sha256 } = await import("@aws-crypto/sha256-js");
  const { fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
  const { HttpRequest } = await import("@smithy/protocol-http");

  const bid = browserIdentifier ?? BROWSER_ID;

  const signer = new SignatureV4({
    credentials: fromNodeProviderChain(),
    region,
    service: "bedrock-agentcore",
    sha256: Sha256,
  });

  const request = new HttpRequest({
    method: "GET",
    protocol: "https:",
    hostname: `bedrock-agentcore.${region}.amazonaws.com`,
    path: `/browser-streams/${bid}/sessions/${sessionId}/live-view`,
    headers: { host: `bedrock-agentcore.${region}.amazonaws.com` },
  });

  const signed = await signer.presign(request, { expiresIn: 300 });
  const qs = Object.entries(signed.query as Record<string, string>)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `https://${signed.hostname}${signed.path}?${qs}`;
}


// ---------------------------------------------------------------------------
// Stop a browser session by ID (works for any session, including agent-created)
// ---------------------------------------------------------------------------

export async function stopBrowserSession(
  sessionId: string,
  browserIdentifier?: string
): Promise<void> {
  const bid = browserIdentifier ?? BROWSER_ID;

  // Try our cached Browser instance first
  const browser = browserInstances.get(sessionId);
  if (browser) {
    try {
      await browser.stopSession();
    } catch {
      // Already terminated
    }
    browserInstances.delete(sessionId);
    activeSessions.delete(sessionId);
    return;
  }

  // For external sessions, use the AWS SDK directly
  try {
    const { StopBrowserSessionCommand } = await import(
      "@aws-sdk/client-bedrock-agentcore"
    );
    await dataClient.send(
      new StopBrowserSessionCommand({
        browserIdentifier: bid,
        sessionId,
      } as any)
    );
  } catch {
    // Session may already be terminated
  }
  activeSessions.delete(sessionId);
}
