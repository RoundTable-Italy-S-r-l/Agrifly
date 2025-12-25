import { Hono } from 'hono';

const app = new Hono();

// ============================================================================
// ORDERS LIST
// ============================================================================

app.get('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('🛒 Richiesta ordini per org:', orgId);

    // Per ora restituiamo un array vuoto - l'endpoint è placeholder
    // In futuro implementare la logica per recuperare gli ordini
    const orders = [];

    console.log('✅ Recuperati', orders.length, 'ordini');

    return c.json(orders);

  } catch (error: any) {
    console.error('❌ Errore get orders:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// Placeholder per altre routes
app.get('/', (c) => c.json({ message: 'orders API' }));

export default app;
