import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerDemoRoutes } from "./routes/demos.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerProfileRoutes } from "./routes/profiles.js";

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

// Register route modules
registerDemoRoutes(server);
registerSessionRoutes(server);
registerProfileRoutes(server);

// Health check
server.get("/api/health", async () => ({ status: "ok" }));

// Debug: list all browser sessions via AWS API
server.get("/api/debug/sessions", async () => {
  const { listBrowserSessions } = await import("./lib/agentcore-browser.js");
  try {
    const sessions = await listBrowserSessions();
    return { count: sessions.length, sessions };
  } catch (e: any) {
    return { error: e.message, name: e.name };
  }
});

try {
  await server.listen({ port: 3001, host: "0.0.0.0" });
  console.log("🚀 AgentCore Browser Demo server running on http://localhost:3001");
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
