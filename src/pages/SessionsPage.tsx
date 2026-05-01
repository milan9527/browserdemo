/**
 * SessionsPage — manage active AgentCore Browser sessions.
 */

import { useState, useEffect, useCallback } from "react";
import { listSessions, startSession, stopSession, type BrowserSession } from "../lib/api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      // Show demo data
      setSessions([
        {
          sessionId: "demo-session-abc123",
          browserIdentifier: "aws.browser.v1",
          status: "ACTIVE",
          startedAt: new Date(Date.now() - 300000).toISOString(),
          automationEndpoint: "wss://bedrock-agentcore.us-west-2.amazonaws.com/...",
          liveViewEndpoint: "wss://bedrock-agentcore.us-west-2.amazonaws.com/...",
        },
        {
          sessionId: "demo-session-def456",
          browserIdentifier: "aws.browser.v1",
          status: "ACTIVE",
          startedAt: new Date(Date.now() - 120000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await startSession({ name: `manual-${Date.now()}` });
      await fetchSessions();
    } catch {
      // Demo mode — add a fake session
      setSessions((prev) => [
        ...prev,
        {
          sessionId: `sim-${Date.now().toString(36)}`,
          browserIdentifier: "aws.browser.v1",
          status: "ACTIVE",
          startedAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setCreating(false);
    }
  };

  const handleStop = async (sessionId: string) => {
    try {
      await stopSession(sessionId);
    } catch {
      // Demo mode
    }
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📡</span> Browser Sessions
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage active AgentCore Browser sessions
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg"
        >
          {creating ? "Starting..." : "New Session"}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
          Server not connected — showing demo data. {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="text-sm">No active sessions</p>
          <p className="text-xs mt-1">Start a new session or run a demo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="border border-gray-800 rounded-lg bg-gray-900/50 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      session.status === "ACTIVE"
                        ? "bg-green-500 animate-pulse-dot"
                        : "bg-gray-600"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-200 font-mono">
                      {session.sessionId}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {session.browserIdentifier} • Started{" "}
                      {new Date(session.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                      session.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-gray-800 text-gray-500 border border-gray-700"
                    }`}
                  >
                    {session.status}
                  </span>
                  <button
                    onClick={() => handleStop(session.sessionId)}
                    className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    Stop
                  </button>
                </div>
              </div>

              {(session.automationEndpoint || session.liveViewEndpoint) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {session.automationEndpoint && (
                    <div className="bg-gray-800/50 rounded px-2 py-1">
                      <p className="text-[10px] text-gray-500">Automation (CDP)</p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        {session.automationEndpoint}
                      </p>
                    </div>
                  )}
                  {session.liveViewEndpoint && (
                    <div className="bg-gray-800/50 rounded px-2 py-1">
                      <p className="text-[10px] text-gray-500">Live View (DCV)</p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        {session.liveViewEndpoint}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Architecture info */}
      <div className="mt-8 border border-gray-800 rounded-lg bg-gray-900/30 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Session Architecture
        </h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
          <div>
            <p className="font-medium text-gray-400 mb-1">Automation Stream</p>
            <p>
              WebSocket CDP endpoint for Playwright. Your agent sends browser
              commands (navigate, click, type) through this channel.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-400 mb-1">Live View Stream</p>
            <p>
              DCV protocol stream that flows directly from AWS to the client
              browser. No video passes through your server.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-400 mb-1">Session Lifecycle</p>
            <p>
              Default TTL: 15 minutes (max 8 hours). Sessions are isolated in
              containers and automatically terminated on expiry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
