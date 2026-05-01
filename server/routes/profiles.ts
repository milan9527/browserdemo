/**
 * Browser profile routes — create, list, delete profiles
 * and save session state to a profile.
 */

import type { FastifyInstance } from "fastify";
import {
  createProfile,
  listProfiles,
  getProfile,
  deleteProfile,
  saveSessionToProfile,
} from "../lib/agentcore-browser.js";

export function registerProfileRoutes(server: FastifyInstance) {
  // List all browser profiles
  server.get("/api/profiles", async () => {
    const profiles = await listProfiles();
    return { profiles };
  });

  // Create a new browser profile
  server.post<{ Body: { name: string } }>("/api/profiles", async (req) => {
    if (!req.body.name) {
      throw { statusCode: 400, message: "name is required" };
    }
    const profile = await createProfile(req.body.name);
    return { profile };
  });

  // Get profile details
  server.get<{ Params: { profileId: string } }>(
    "/api/profiles/:profileId",
    async (req) => {
      const profile = await getProfile(req.params.profileId);
      return { profile };
    }
  );

  // Delete a profile
  server.delete<{ Params: { profileId: string } }>(
    "/api/profiles/:profileId",
    async (req) => {
      await deleteProfile(req.params.profileId);
      return { status: "deleted" };
    }
  );

  // Save current session state to a profile
  server.post<{
    Params: { profileId: string };
    Body: { sessionId: string };
  }>("/api/profiles/:profileId/save", async (req) => {
    if (!req.body.sessionId) {
      throw { statusCode: 400, message: "sessionId is required" };
    }
    await saveSessionToProfile(req.body.sessionId, req.params.profileId);
    return { status: "saved" };
  });
}
