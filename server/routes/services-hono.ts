import { Hono } from 'hono';

const app = new Hono();

// Placeholder per services routes
app.get('/', (c) => c.json({ message: 'services API' }));

export default app;
