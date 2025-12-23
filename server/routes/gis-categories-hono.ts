import { Hono } from 'hono';

const app = new Hono();

// Placeholder per gis-categories routes
app.get('/', (c) => c.json({ message: 'gis-categories API' }));

export default app;
