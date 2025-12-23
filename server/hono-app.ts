import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import delle routes esistenti (convertite da Express)
import authRoutes from './routes/auth-hono';
import demoRoutes from './routes/demo-hono';
import dronesRoutes from './routes/drones-hono';
import cropsRoutes from './routes/crops-hono';
import treatmentsRoutes from './routes/treatments-hono';
import affiliatesRoutes from './routes/affiliates-hono';
import fieldsRoutes from './routes/fields-hono';
import gisCategoriesRoutes from './routes/gis-categories-hono';
import ordersRoutes from './routes/orders-hono';
import missionsRoutes from './routes/missions-hono';
import catalogRoutes from './routes/catalog-hono';
import offersRoutes from './routes/offers-hono';
import servicesRoutes from './routes/services-hono';
import operatorsRoutes from './routes/operators-hono';
import bookingsRoutes from './routes/bookings-hono';
import settingsRoutes from './routes/settings-hono';

// Crea app Hono
const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Logging middleware per debug (come Express)
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) {
    console.log(`📡 ${c.req.method} ${c.req.path}`);
  }
  await next();
});

// Monta le routes
app.route('/api/auth', authRoutes);
app.route('/api/demo', demoRoutes);
app.route('/api/drones', dronesRoutes);
app.route('/api/crops', cropsRoutes);
app.route('/api/treatments', treatmentsRoutes);
app.route('/api/affiliates', affiliatesRoutes);
app.route('/api/fields', fieldsRoutes);
app.route('/api/gis-categories', gisCategoriesRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/missions', missionsRoutes);
app.route('/api/catalog', catalogRoutes);
app.route('/api/offers', offersRoutes);
app.route('/api/services', servicesRoutes);
app.route('/api/operators', operatorsRoutes);
app.route('/api/bookings', bookingsRoutes);
app.route('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
