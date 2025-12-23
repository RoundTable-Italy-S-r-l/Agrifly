import { Hono } from 'hono';

const app = new Hono();

// Placeholder per offers routes
app.get('/', (c) => c.json({ message: 'offers API' }));

export default app;
