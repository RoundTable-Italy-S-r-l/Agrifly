import { Hono } from 'hono';

const app = new Hono();

// Placeholder per settings routes
app.get('/', (c) => c.json({ message: 'settings API' }));

export default app;
