import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// BOOKINGS LIST
// ============================================================================

app.get('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const period = c.req.query('period') || 'week';

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('📅 Richiesta bookings per org:', orgId, 'periodo:', period);

    // Per ora restituiamo un array vuoto - l'endpoint è placeholder
    // In futuro implementare la logica per recuperare le prenotazioni
    const bookings = [];

    console.log('✅ Recuperati', bookings.length, 'bookings');

    return c.json(bookings);

  } catch (error: any) {
    console.error('❌ Errore get bookings:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// Placeholder per altre routes
app.get('/', (c) => c.json({ message: 'bookings API' }));

export default app;
