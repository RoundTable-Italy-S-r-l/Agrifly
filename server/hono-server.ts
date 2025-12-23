import 'dotenv/config';
import app from './hono-app';

// Per sviluppo locale con Hono invece di Express
const port = process.env.PORT || 3001;

console.log(`🚀 Hono server starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
