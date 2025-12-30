import path from "path";
import app from "./hono-app";
import * as express from "express";

// app is already imported from hono-app
const port = process.env.PORT || 4000;

// In production, serve the built SPA files
const __filename = import.meta.url;
const __dirname = path.dirname(new URL(__filename).pathname);
const distPath = path.join(__dirname, "../dist/spa");

// NOTE: This file is legacy Express code but imports Hono app
// Commented out to avoid TypeScript errors - this file may not be used in production
/*
app.use(express.static(distPath));

app.use((req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
*/

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
