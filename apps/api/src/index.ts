/**
 * GlassVault - API Server Entry Point
 *
 * Express server serving as the agent backend.
 * Routes will be registered here as feature phases are implemented.
 */
import express from "express";
import cors from "cors";

// Vercel handles environment variables via dashboard.

const app = express();
const PORT = process.env.PORT ?? "3001";

// Middleware
app.use(cors());
app.use(express.json());

import chainsRouter from "./routes/chains";
import agentRouter from "./routes/agent";

// Health check - verifies server is running
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "glassvault-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

import webhookRouter from "./routes/webhook";

// Register routes
app.use("/api/chains", chainsRouter);
app.use("/api/agent", agentRouter);
app.use("/api/webhook", webhookRouter);

// Routes will be registered here in subsequent phases:
// Phase 2: GET  /api/chains       - chain + relayer capabilities
// Phase 5: POST /api/agent/execute - agent loop execution
// Phase 7: POST /api/webhooks/1shot - 1Shot status callbacks
// Phase 7: GET  /api/events/stream  - SSE real-time feed

// Only listen locally, Vercel handles routing to exported app automatically
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[GlassVault API] Server running on http://localhost:${PORT}`);
    console.log(`[GlassVault API] Health: http://localhost:${PORT}/api/health`);
  });
}

export default app;
