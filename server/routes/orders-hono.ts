import { Hono } from 'hono';

const app = new Hono();

// Placeholder per orders routes
app.get('/', (c) => c.json({ message: 'orders API' }));

export default app;
