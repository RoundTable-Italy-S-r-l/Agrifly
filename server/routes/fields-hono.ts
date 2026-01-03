import { Hono } from "hono";

const app = new Hono();

// Placeholder per fields routes
app.get("/", (c) => c.json({ message: "fields API" }));

export default app;
