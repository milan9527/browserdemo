/**
 * Session management routes — start, stop, list browser sessions
 * and generate DCV Live View URLs.
 */

import type { FastifyInstance } from "fastify";
import {
  startSession,
  stopSession,
  listActiveSessions,
  getActiveSession,
  generateLiveViewUrl,
} from "../lib/agentcore-browser.js";

export function registerSessionRoutes(server: FastifyInstance) {
  // List all active sessions
  server.get("/api/sessions", async () => {
    return { sessions: listActiveSessions() };
  });

  // Start a new browser session
  server.post<{
    Body: {
      name?: string;
      profileId?: string;
      timeoutSeconds?: number;
      viewport?: { width: number; height: number };
    };
  }>("/api/sessions", async (req) => {
    const session = await startSession({
      name: req.body.name,
      profileId: req.body.profileId,
      timeoutSeconds: req.body.timeoutSeconds,
      viewport: req.body.viewport,
    });
    const liveViewUrl = await generateLiveViewUrl(session.sessionId);
    return { session, liveViewUrl };
  });

  // Get session details + live view URL
  server.get<{ Params: { sessionId: string } }>(
    "/api/sessions/:sessionId",
    async (req, reply) => {
      const session = getActiveSession(req.params.sessionId);
      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }
      const liveViewUrl = await generateLiveViewUrl(session.sessionId);
      return { session, liveViewUrl };
    }
  );

  // Stop a session
  server.delete<{ Params: { sessionId: string } }>(
    "/api/sessions/:sessionId",
    async (req) => {
      await stopSession(req.params.sessionId);
      return { status: "stopped" };
    }
  );

  // Get live view URL for a session
  server.get<{ Params: { sessionId: string } }>(
    "/api/sessions/:sessionId/live-view",
    async (req, reply) => {
      const session = getActiveSession(req.params.sessionId);
      if (!session) {
        return reply.status(404).send({ error: "Session not found" });
      }
      const url = await generateLiveViewUrl(session.sessionId);
      return { liveViewUrl: url };
    }
  );
}
