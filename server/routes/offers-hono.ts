import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// GET OFFERS
// ============================================================================

app.get('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    console.log('🎁 Richiesta offerte per org:', orgId);

    // Query per ottenere tutte le offerte (bundle, promo, season package)
    const offersResult = await query(`
      SELECT 
        id,
        vendor_org_id,
        offer_type,
        name,
        rules_json,
        valid_from,
        valid_to,
        status
      FROM offers
      WHERE vendor_org_id = $1
      ORDER BY valid_from DESC
    `, [orgId]);

    console.log(`📋 Offerte trovate nel DB: ${offersResult.rows.length}`);

    const offers = offersResult.rows.map(row => {
      // Parse rules_json se è una stringa
      let rules_json = row.rules_json;
      if (typeof rules_json === 'string') {
        try {
          rules_json = JSON.parse(rules_json);
        } catch (e) {
          console.warn('⚠️  Errore parsing rules_json per offerta:', row.id, e);
          rules_json = null;
        }
      }

      return {
        id: row.id,
        vendor_org_id: row.vendor_org_id,
        offer_type: row.offer_type,
        name: row.name,
        rules_json: rules_json,
        valid_from: row.valid_from ? new Date(row.valid_from).toISOString() : null,
        valid_to: row.valid_to ? new Date(row.valid_to).toISOString() : null,
        status: row.status
      };
    });

    console.log(`✅ Offerte formattate: ${offers.length}`);

    return c.json(offers);

  } catch (error: any) {
    console.error('❌ Errore get offers:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

export default app;
