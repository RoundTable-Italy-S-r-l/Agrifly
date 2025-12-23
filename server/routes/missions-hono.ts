import { Hono } from 'hono';

const app = new Hono();

// Placeholder per missions routes
app.get('/', (c) => c.json({ message: 'missions API' }));

export default app;
