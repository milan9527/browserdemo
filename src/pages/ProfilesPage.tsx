/**
 * ProfilesPage — list, view details, create, and delete browser profiles.
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "";

interface BrowserProfile {
  profileId: string;
  name: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSavedAt?: string;
  lastSavedBrowserSessionId?: string;
  lastSavedBrowserId?: string;
  description?: string;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, any>>({});

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/profiles`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setProfiles(data.profiles ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const fetchDetails = async (profileId: string) => {
    if (details[profileId]) return; // already fetched
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails((prev) => ({ ...prev, [profileId]: data.profile }));
      }
    } catch { /* ignore */ }
  };

  const toggleExpand = (profileId: string) => {
    if (expandedId === profileId) {
      setExpandedId(null);
    } else {
      setExpandedId(profileId);
      fetchDetails(profileId);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch(`${API_BASE}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      fetchProfiles();
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  const handleDelete = async (profileId: string) => {
    try {
      await fetch(`${API_BASE}/api/profiles/${profileId}`, { method: "DELETE" });
    } catch { /* ignore */ }
    setExpandedId(null);
    fetchProfiles();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>👤</span> Browser Profiles
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Persist cookies and localStorage across browser sessions</p>
        </div>
        <button onClick={fetchProfiles} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {/* Create */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Profile name (letters, numbers, underscores only)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg"
        >
          {creating ? "Creating..." : "Create"}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="text-sm">No browser profiles</p>
          <p className="text-xs mt-1">Create a profile or use the Persistent Session demo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.profileId} className="border border-gray-800 rounded-lg bg-gray-900/50 overflow-hidden">
              {/* Header row */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/30 transition-colors"
                onClick={() => toggleExpand(p.profileId)}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${expandedId === p.profileId ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{p.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{p.profileId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.status && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      {p.status}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.profileId); }}
                    className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === p.profileId && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-800">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-xs">
                    <DetailRow label="Profile ID" value={p.profileId} mono />
                    <DetailRow label="Name" value={p.name} />
                    <DetailRow label="Status" value={p.status} />
                    <DetailRow label="Created" value={p.createdAt ? new Date(p.createdAt).toLocaleString() : undefined} />
                    <DetailRow label="Updated" value={p.updatedAt ? new Date(p.updatedAt).toLocaleString() : undefined} />
                    <DetailRow label="Last Saved" value={p.lastSavedAt ? new Date(p.lastSavedAt).toLocaleString() : undefined} />
                    <DetailRow label="Last Saved Session" value={p.lastSavedBrowserSessionId} mono />
                    <DetailRow label="Last Saved Browser" value={p.lastSavedBrowserId} mono />
                    {details[p.profileId] && (
                      <>
                        <DetailRow label="Description" value={details[p.profileId].description} />
                        <DetailRow label="ARN" value={details[p.profileId].profileArn} mono />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className={`text-gray-300 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
    </div>
  );
}
