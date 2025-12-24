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

    const offers = offersResult.rows.map(row => ({
      id: row.id,
      vendorOrgId: row.vendor_org_id,
      offerType: row.offer_type,
      name: row.name,
      rules: row.rules_json,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      status: row.status
    }));

    console.log(`✅ Offerte trovate: ${offers.length}`);

    return c.json(offers);

  } catch (error: any) {
    console.error('Errore get offers:', error);
    return c.json({ error: 'Errore interno', message: error.message }, 500);
  }
});

export default app;
