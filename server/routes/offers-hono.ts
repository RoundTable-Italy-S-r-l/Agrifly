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
      ORDER BY valid_from DESC, created_at DESC
    `, [orgId]);

    console.log(`📋 Offerte trovate nel DB: ${offersResult.rows.length}`);

    const offers = offersResult.rows.map(row => {
      // Parse rules_json se è una stringa
      let rules = row.rules_json;
      if (typeof rules === 'string') {
        try {
          rules = JSON.parse(rules);
        } catch (e) {
          console.warn('⚠️  Errore parsing rules_json per offerta:', row.id, e);
          rules = null;
        }
      }

      return {
        id: row.id,
        vendorOrgId: row.vendor_org_id,
        offerType: row.offer_type,
        name: row.name,
        rules: rules,
        validFrom: row.valid_from ? new Date(row.valid_from).toISOString() : null,
        validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null,
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
