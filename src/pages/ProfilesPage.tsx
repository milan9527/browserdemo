/**
 * ProfilesPage — manage browser profiles for persistent sessions.
 */

import { useState, useEffect, useCallback } from "react";
import {
  listProfilesApi,
  createProfileApi,
  deleteProfileApi,
  type BrowserProfile,
} from "../lib/api";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const data = await listProfilesApi();
      setProfiles(data.profiles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
      // Show demo data
      setProfiles([
        {
          profileId: "prof-demo-001",
          name: "ecommerce-auth",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          profileId: "prof-demo-002",
          name: "internal-portal",
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProfileApi(newName.trim());
      await fetchProfiles();
    } catch {
      // Demo mode
      setProfiles((prev) => [
        ...prev,
        {
          profileId: `prof-${Date.now().toString(36)}`,
          name: newName.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setNewName("");
      setCreating(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    try {
      await deleteProfileApi(profileId);
    } catch {
      // Demo mode
    }
    setProfiles((prev) => prev.filter((p) => p.profileId !== profileId));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>👤</span> Browser Profiles
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Persist cookies and localStorage across browser sessions
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
          Server not connected — showing demo data. {error}
        </div>
      )}

      {/* Create profile form */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Profile name (e.g. my-auth-profile)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg"
        >
          {creating ? "Creating..." : "Create Profile"}
        </button>
      </div>

      {/* Profile list */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading profiles...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="text-sm">No browser profiles</p>
          <p className="text-xs mt-1">Create a profile to persist session state</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.profileId}
              className="border border-gray-800 rounded-lg bg-gray-900/50 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {profile.name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {profile.profileId}
                  </p>
                  <div className="flex gap-4 mt-1 text-[10px] text-gray-600">
                    {profile.createdAt && (
                      <span>
                        Created: {new Date(profile.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    {profile.updatedAt && (
                      <span>
                        Updated: {new Date(profile.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.profileId);
                    }}
                    className="px-3 py-1 text-xs text-gray-400 hover:bg-gray-800 rounded-lg border border-gray-700"
                    title="Copy profile ID"
                  >
                    Copy ID
                  </button>
                  <button
                    onClick={() => handleDelete(profile.profileId)}
                    className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile lifecycle diagram */}
      <div className="mt-8 border border-gray-800 rounded-lg bg-gray-900/30 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Browser Profile Lifecycle
        </h3>
        <div className="flex items-center gap-2 text-xs overflow-x-auto pb-2">
          {[
            { step: "1", label: "Create Profile", desc: "create_browser_profile()" },
            { step: "2", label: "Start Session", desc: "start_browser_session()" },
            { step: "3", label: "Perform Actions", desc: "Login, browse, fill forms" },
            { step: "4", label: "Save Profile", desc: "save_browser_session_profile()" },
            { step: "5", label: "Reuse Profile", desc: "start_browser_session(profile)" },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-2 shrink-0">
              {i > 0 && (
                <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 min-w-[140px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[10px] flex items-center justify-center font-bold">
                    {item.step}
                  </span>
                  <span className="font-medium text-gray-300">{item.label}</span>
                </div>
                <p className="text-[10px] text-gray-500 font-mono">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <p className="font-medium text-gray-400 mb-1">What's Persisted</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Cookies (authentication tokens, session IDs)</li>
              <li>localStorage data</li>
              <li>Session storage</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-400 mb-1">Considerations</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Cookies expire per website policy</li>
              <li>Save overwrites previous profile data</li>
              <li>Concurrent sessions are isolated</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
