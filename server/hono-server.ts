import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './hono-app';

// Per sviluppo locale con Hono invece di Express
const port = process.env.PORT || 3001;

console.log(`🚀 Hono server starting on port ${port}...`);
console.log(`🔑 GRAPHHOPPER_API_KEY:`, process.env.GRAPHHOPPER_API_KEY ? 'Present' : 'Missing');
console.log(`📦 DATABASE_URL:`, process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'Not set');

// Error handler globale
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

const server = serve({
  fetch: app.fetch,
  port: Number(port),
});

console.log(`✅ Hono server listening on http://localhost:${port}`);
