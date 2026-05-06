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

// List all browser tools and their active sessions
server.get("/api/browser/sessions", async () => {
  const { BedrockAgentCoreClient, ListBrowserSessionsCommand } = await import("@aws-sdk/client-bedrock-agentcore");
  const { BedrockAgentCoreControlClient, ListBrowsersCommand } = await import("@aws-sdk/client-bedrock-agentcore-control");

  const region = process.env.AWS_REGION ?? "us-east-1";
  const dataClient = new BedrockAgentCoreClient({ region });
  const controlClient = new BedrockAgentCoreControlClient({ region });

  // 1. List all browser tools
  const browsersRes = await controlClient.send(new ListBrowsersCommand({} as any));
  const browsers = (browsersRes as any).browserSummaries ?? [];

  // Include the built-in browser
  const allBrowsers = [
    { browserId: "aws.browser.v1", name: "Built-in Browser", status: "READY" },
    ...browsers.map((b: any) => ({ browserId: b.browserId, name: b.name, status: b.status })),
  ];

  // 2. For each browser, list READY/ACTIVE sessions
  const result = [];
  for (const browser of allBrowsers) {
    try {
      const sessRes = await dataClient.send(
        new ListBrowserSessionsCommand({ browserIdentifier: browser.browserId } as any)
      );
      const sessions = ((sessRes as any).items ?? [])
        .filter((s: any) => s.status === "READY" || s.status === "ACTIVE")
        .map((s: any) => ({
          sessionId: s.sessionId,
          status: s.status,
          name: s.name,
          createdAt: s.createdAt,
        }));
      result.push({ ...browser, sessions });
    } catch {
      result.push({ ...browser, sessions: [] });
    }
  }

  return { browsers: result };
});

// Terminate a browser session
server.delete<{ Params: { sessionId: string }; Body: { browserIdentifier?: string } }>(
  "/api/browser/sessions/:sessionId",
  async (req) => {
    const { stopBrowserSession } = await import("./lib/agentcore-browser.js");
    await stopBrowserSession(req.params.sessionId, req.body?.browserIdentifier);
    return { status: "terminated" };
  }
);

try {
  await server.listen({ port: 3001, host: "0.0.0.0" });
  console.log("🚀 AgentCore Browser Demo server running on http://localhost:3001");
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
