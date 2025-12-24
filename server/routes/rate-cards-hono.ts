import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// GET /api/rate-cards - Lista tutte le rate cards
app.get('/', async (c) => {
  try {
    const result = await query(`
      SELECT
        id,
        seller_org_id,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        hourly_operator_rate_cents,
        seasonal_multipliers_json,
        risk_multipliers_json
      FROM rate_cards
      ORDER BY seller_org_id, service_type
    `);

    const rateCards = result.rows.map(row => ({
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: row.base_rate_per_ha_cents,
      min_charge_cents: row.min_charge_cents,
      travel_rate_per_km_cents: row.travel_rate_per_km_cents,
      hourly_operator_rate_cents: row.hourly_operator_rate_cents,
      seasonal_multipliers_json: typeof row.seasonal_multipliers_json === 'string'
        ? JSON.parse(row.seasonal_multipliers_json)
        : row.seasonal_multipliers_json,
      risk_multipliers_json: typeof row.risk_multipliers_json === 'string'
        ? JSON.parse(row.risk_multipliers_json)
        : row.risk_multipliers_json
    }));

    return c.json(rateCards);
  } catch (error: any) {
    console.error('Error fetching rate cards:', error);
    return c.json({ error: 'Failed to fetch rate cards', details: error.message }, 500);
  }
});

// GET /api/rate-cards/:id - Dettaglio singola rate card
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await query(`
      SELECT
        id,
        seller_org_id,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        hourly_operator_rate_cents,
        seasonal_multipliers_json,
        risk_multipliers_json
      FROM rate_cards
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found' }, 404);
    }

    const row = result.rows[0];
    const rateCard = {
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: row.base_rate_per_ha_cents,
      min_charge_cents: row.min_charge_cents,
      travel_rate_per_km_cents: row.travel_rate_per_km_cents,
      hourly_operator_rate_cents: row.hourly_operator_rate_cents,
      seasonal_multipliers_json: typeof row.seasonal_multipliers_json === 'string'
        ? JSON.parse(row.seasonal_multipliers_json)
        : row.seasonal_multipliers_json,
      risk_multipliers_json: typeof row.risk_multipliers_json === 'string'
        ? JSON.parse(row.risk_multipliers_json)
        : row.risk_multipliers_json
    };

    return c.json(rateCard);
  } catch (error: any) {
    console.error('Error fetching rate card:', error);
    return c.json({ error: 'Failed to fetch rate card', details: error.message }, 500);
  }
});

// POST /api/rate-cards - Crea nuova rate card
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      seller_org_id,
      service_type,
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json
    } = body;

    // Validazione base
    if (!seller_org_id || !service_type || !base_rate_per_ha_cents || !min_charge_cents || !travel_rate_per_km_cents) {
      return c.json({
        error: 'Missing required fields: seller_org_id, service_type, base_rate_per_ha_cents, min_charge_cents, travel_rate_per_km_cents'
      }, 400);
    }

    // Genera ID
    const id = `rc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const result = await query(`
      INSERT INTO rate_cards (
        id,
        seller_org_id,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        hourly_operator_rate_cents,
        seasonal_multipliers_json,
        risk_multipliers_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      id,
      seller_org_id,
      service_type,
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents || null,
      JSON.stringify(seasonal_multipliers_json || {}),
      JSON.stringify(risk_multipliers_json || {})
    ]);

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    console.error('Error creating rate card:', error);

    // Check for unique constraint violation
    if (error.message?.includes('duplicate key') || error.code === '23505') {
      return c.json({
        error: 'A rate card already exists for this organization and service type',
        details: error.message
      }, 409);
    }

    return c.json({ error: 'Failed to create rate card', details: error.message }, 500);
  }
});

// PUT /api/rate-cards/:id - Modifica rate card
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const {
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json
    } = body;

    const result = await query(`
      UPDATE rate_cards
      SET
        base_rate_per_ha_cents = $1,
        min_charge_cents = $2,
        travel_rate_per_km_cents = $3,
        hourly_operator_rate_cents = $4,
        seasonal_multipliers_json = $5,
        risk_multipliers_json = $6
      WHERE id = $7
      RETURNING *
    `, [
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents || null,
      JSON.stringify(seasonal_multipliers_json || {}),
      JSON.stringify(risk_multipliers_json || {}),
      id
    ]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating rate card:', error);
    return c.json({ error: 'Failed to update rate card', details: error.message }, 500);
  }
});

// DELETE /api/rate-cards/:id - Elimina rate card
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await query(`
      DELETE FROM rate_cards
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found' }, 404);
    }

    return c.json({ message: 'Rate card deleted successfully', id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting rate card:', error);
    return c.json({ error: 'Failed to delete rate card', details: error.message }, 500);
  }
});

export default app;
