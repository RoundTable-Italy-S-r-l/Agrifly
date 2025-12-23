import { Hono } from 'hono';

const app = new Hono();

// Placeholder per catalog routes
app.get('/', (c) => c.json({ message: 'catalog API' }));

export default app;
