import { Hono } from 'hono';

const app = new Hono();

// Placeholder per treatments routes
app.get('/', (c) => c.json({ message: 'treatments API' }));

export default app;
