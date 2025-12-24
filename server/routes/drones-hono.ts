import { Hono } from 'hono';

const app = new Hono();

// Placeholder semplificato per evitare errori di bundling
app.get('/', (c) => c.json({ message: 'Drones API - semplificato per deploy' }));
app.get('/:id', (c) => c.json({ message: 'Drone detail - semplificato per deploy', id: c.req.param('id') }));

export default app;
