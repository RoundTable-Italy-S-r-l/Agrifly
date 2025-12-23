import { Hono } from 'hono';

const app = new Hono();

// Placeholder per drones routes
app.get('/', (c) => c.json({ message: 'drones API' }));

export default app;
