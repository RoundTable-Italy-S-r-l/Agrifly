import { Hono } from "hono";

const app = new Hono();

// Placeholder per crops routes
app.get("/", (c) => c.json({ message: "crops API" }));

export default app;
