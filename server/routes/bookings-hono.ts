import { Hono } from 'hono';

const app = new Hono();

// Placeholder per bookings routes
app.get('/', (c) => c.json({ message: 'bookings API' }));

export default app;
