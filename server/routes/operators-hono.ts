import { Hono } from 'hono';

const app = new Hono();

// Placeholder per operators routes
app.get('/', (c) => c.json({ message: 'operators API' }));

export default app;
