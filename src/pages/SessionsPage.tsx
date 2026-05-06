/**
 * SessionsPage — list all browser tools and their active sessions.
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "";

interface BrowserTool {
  browserId: string;
  name: string;
  status: string;
  sessions: {
    sessionId: string;
    status: string;
    name?: string;
    createdAt?: string;
  }[];
}

export default function SessionsPage() {
  const [browsers, setBrowsers] = useState<BrowserTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/browser/sessions`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setBrowsers(data.browsers ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStop = async (browserId: string, sessionId: string) => {
    try {
      await fetch(`${API_BASE}/api/browser/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browserIdentifier: browserId }),
      });
    } catch { /* ignore */ }
    fetchData();
  };

  const totalSessions = browsers.reduce((sum, b) => sum + b.sessions.length, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📡</span> Browser Sessions
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalSessions} active session{totalSessions !== 1 ? "s" : ""} across {browsers.length} browser tool{browsers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : (
        <div className="space-y-4">
          {browsers.map((b) => (
            <div key={b.browserId} className="border border-gray-800 rounded-lg bg-gray-900/50">
              {/* Browser tool header */}
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌐</span>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{b.name}</p>
                    <p className="text-[10px] font-mono text-gray-500">{b.browserId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                    b.status === "READY" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-800 text-gray-500 border border-gray-700"
                  }`}>{b.status}</span>
                  <span className="text-[10px] text-gray-500">{b.sessions.length} session{b.sessions.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Sessions */}
              {b.sessions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-600">No active sessions</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {b.sessions.map((s) => (
                    <div key={s.sessionId} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-gray-300">{s.sessionId}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {s.name ?? "unnamed"}
                          {s.createdAt ? ` • ${new Date(s.createdAt).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                          s.status === "READY" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        }`}>{s.status}</span>
                        <button
                          onClick={() => handleStop(b.browserId, s.sessionId)}
                          className="px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10 rounded border border-red-500/20"
                        >
                          Terminate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
