import { Hono } from "hono";

const app = new Hono();

// Placeholder per demo routes
app.get("/", (c) => c.json({ message: "Demo API" }));

export default app;
