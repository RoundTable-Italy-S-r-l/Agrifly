import { Hono } from 'hono';
import { query } from '../utils/database';
import { authMiddleware } from '../middleware/auth';
import { CreateOfferSchema, UpdateOfferSchema } from '../schemas/api.schemas';

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

// ============================================================================
// POST /api/offers - Create offer
// ============================================================================

app.post('/', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    // Parse and validate request body
    const body = await c.req.json();

    // Set vendor_org_id from authenticated user
    body.vendor_org_id = user.organizationId;

    // Validate input
    const validationResult = CreateOfferSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json({
        error: 'Dati non validi',
        details: validationResult.error.issues
      }, 400);
    }

    const data = validationResult.data;

    console.log('🎁 Creazione offerta:', data);

    // Insert offer into database
    const insertResult = await query(`
      INSERT INTO offers (
        id, vendor_org_id, offer_type, name, rules_json,
        valid_from, valid_to, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      )
      RETURNING *
    `, [
      data.vendor_org_id,
      data.offer_type,
      data.name,
      JSON.stringify(data.rules_json),
      data.valid_from,
      data.valid_to || null,
      data.status
    ]);

    const newOffer = insertResult.rows[0];

    console.log('✅ Offerta creata:', newOffer.id);

    return c.json({
      id: newOffer.id,
      vendor_org_id: newOffer.vendor_org_id,
      offer_type: newOffer.offer_type,
      name: newOffer.name,
      rules_json: JSON.parse(newOffer.rules_json),
      valid_from: newOffer.valid_from,
      valid_to: newOffer.valid_to,
      status: newOffer.status
    });

  } catch (error: any) {
    console.error('❌ Errore create offer:', error);
    console.error('Stack:', error.stack);
    return c.json({
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

// ============================================================================
// PUT /api/offers/:offerId - Update offer
// ============================================================================

app.put('/:offerId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    const offerId = c.req.param('offerId');
    const body = await c.req.json();

    // Validate input
    const validationResult = UpdateOfferSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json({
        error: 'Dati non validi',
        details: validationResult.error.issues
      }, 400);
    }

    const data = validationResult.data;

    console.log('🔄 Aggiornamento offerta:', { offerId, data });

    // Verify the offer belongs to the user's vendor
    const offerCheck = await query(
      'SELECT id, vendor_org_id FROM offers WHERE id = $1',
      [offerId]
    );

    if (offerCheck.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    if (offerCheck.rows[0].vendor_org_id !== user.organizationId) {
      return c.json({ error: 'Non autorizzato a modificare questa offerta' }, 403);
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.rules_json !== undefined) {
      updateFields.push(`rules_json = $${paramIndex++}`);
      values.push(JSON.stringify(data.rules_json));
    }

    if (data.valid_from !== undefined) {
      updateFields.push(`valid_from = $${paramIndex++}`);
      values.push(data.valid_from);
    }

    if (data.valid_to !== undefined) {
      updateFields.push(`valid_to = $${paramIndex++}`);
      values.push(data.valid_to);
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'Nessun campo da aggiornare' }, 400);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(offerId); // Add offerId as last parameter

    const updateQuery = `
      UPDATE offers
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await query(updateQuery, values);

    if (updateResult.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    const updatedOffer = updateResult.rows[0];

    console.log('✅ Offerta aggiornata:', offerId);

    return c.json({
      id: updatedOffer.id,
      vendor_org_id: updatedOffer.vendor_org_id,
      offer_type: updatedOffer.offer_type,
      name: updatedOffer.name,
      rules_json: JSON.parse(updatedOffer.rules_json),
      valid_from: updatedOffer.valid_from,
      valid_to: updatedOffer.valid_to,
      status: updatedOffer.status
    });

  } catch (error: any) {
    console.error('❌ Errore update offer:', error);
    console.error('Stack:', error.stack);
    return c.json({
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

// ============================================================================
// DELETE /api/offers/:offerId - Delete offer
// ============================================================================

app.delete('/:offerId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    const offerId = c.req.param('offerId');

    console.log('🗑️ Eliminazione offerta:', offerId);

    // Verify the offer belongs to the user's vendor
    const offerCheck = await query(
      'SELECT id, vendor_org_id FROM offers WHERE id = $1',
      [offerId]
    );

    if (offerCheck.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    if (offerCheck.rows[0].vendor_org_id !== user.organizationId) {
      return c.json({ error: 'Non autorizzato a eliminare questa offerta' }, 403);
    }

    // Delete offer from database
    const deleteResult = await query(`
      DELETE FROM offers
      WHERE id = $1
      RETURNING id
    `, [offerId]);

    if (deleteResult.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    console.log('✅ Offerta eliminata:', offerId);

    return c.json({ success: true, message: 'Offerta eliminata con successo' });

  } catch (error: any) {
    console.error('❌ Errore delete offer:', error);
    console.error('Stack:', error.stack);
    return c.json({
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

export default app;
