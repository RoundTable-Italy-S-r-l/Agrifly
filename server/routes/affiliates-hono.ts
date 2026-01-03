import { Hono } from "hono";

const app = new Hono();

// Placeholder per affiliates routes
app.get("/", (c) => c.json({ message: "affiliates API" }));

export default app;
