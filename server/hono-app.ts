import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import delle routes (usa database SQLite/PostgreSQL)
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
import ecommerceRoutes from './routes/ecommerce-hono';
import routingRoutes from './routes/routing-hono';
import settingsRoutes from './routes/settings-hono';
import bookingsRoutes from './routes/bookings-hono';
// import settingsRoutes from './routes/settings-hono';
import jobsRoutes from './routes/jobs-hono';
import savedFieldsRoutes from './routes/saved-fields-hono';
import quoteEstimateRoutes from './routes/quote-estimate-hono';
import certifiedQuotesRoutes from './routes/certified-quotes-hono';

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
// app.route('/api/offers', offersRoutes); // Disabled - using jobsRoutes instead
app.route('/api/services', servicesRoutes);
app.route('/api/operators', operatorsRoutes);
app.route('/api/ecommerce', ecommerceRoutes);
app.route('/api/routing', routingRoutes);
app.route('/api/service-config', settingsRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/bookings', bookingsRoutes);
app.route('/api/jobs', jobsRoutes);
app.route('/api/quote-estimate', quoteEstimateRoutes);
app.route('/api/certified-quotes', certifiedQuotesRoutes);

// Saved fields routes
app.route('/api/saved-fields', savedFieldsRoutes);

// Offers routes
app.route('/api/offers', jobsRoutes);

// Debug endpoint to check auth headers
app.get('/api/debug-auth', async (c) => {
  const authHeader = c.req.header('Authorization');
  return c.json({
    hasAuthHeader: !!authHeader,
    authHeader: authHeader ? authHeader.substring(0, 50) + '...' : null,
    timestamp: new Date().toISOString()
  });
});

// Health check globale (compatibilità)
app.get('/api/health', async (c) => {
  try {
    const { query } = await import('./utils/database');
    // Test semplice connessione
    const result = await query('SELECT 1 as test');
    console.log('Health check result:', result.rows);

    return c.json({
      timestamp: new Date().toISOString(),
      status: 'ok',
      database: 'connected',
      environment: process.env.NODE_ENV,
      test_result: result.rows[0]
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      stack: error.stack?.substring(0, 200)
    }, 500);
  }
});

// Error handler globale
app.onError((err, c) => {
  console.error('❌ Global error handler:', err);
  console.error('❌ Error message:', err.message);
  console.error('❌ Error stack:', err.stack);
  return c.json({ 
    error: 'Internal server error',
    message: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, 500);
});

// 404 handler
app.notFound((c) => {
  console.log('❌ Route not found:', c.req.path);
  return c.json({ error: 'Route not found' }, 404);
});

export default app;
