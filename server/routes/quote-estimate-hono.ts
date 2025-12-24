import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// POST /api/quote-estimate - Calcola preventivo dinamico da rate_cards
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { seller_org_id, service_type, area_ha, distance_km = 0, risk_key, month } = body;

    // Validazione input
    if (!seller_org_id || !service_type || !area_ha || area_ha <= 0) {
      return c.json({
        error: 'Missing or invalid required fields: seller_org_id, service_type, area_ha'
      }, 400);
    }

    // Leggi rate card dal database
    const result = await query(`
      SELECT
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        seasonal_multipliers_json,
        risk_multipliers_json
      FROM rate_cards
      WHERE seller_org_id = $1 AND service_type = $2
      LIMIT 1
    `, [seller_org_id, service_type]);

    if (result.rows.length === 0) {
      return c.json({
        error: `No rate card found for seller_org_id=${seller_org_id}, service_type=${service_type}`,
        hint: 'Please create a rate card in the database first'
      }, 404);
    }

    const rateCard = result.rows[0];

    // Calcolo base: area × rate
    const baseCents = Math.round(area_ha * rateCard.base_rate_per_ha_cents);

    // Calcolo travel: distance × km_rate
    const travelCents = Math.round(distance_km * rateCard.travel_rate_per_km_cents);

    // Subtotal prima dei moltiplicatori
    const subtotalCents = baseCents + travelCents;

    // Applica moltiplicatori stagionali (se presenti)
    let seasonalMult = 1.0;
    if (month && rateCard.seasonal_multipliers_json) {
      const seasonalMultipliers = typeof rateCard.seasonal_multipliers_json === 'string'
        ? JSON.parse(rateCard.seasonal_multipliers_json)
        : rateCard.seasonal_multipliers_json;

      seasonalMult = seasonalMultipliers[month] || 1.0;
    }

    // Applica moltiplicatori di rischio (se presenti)
    let riskMult = 1.0;
    if (risk_key && rateCard.risk_multipliers_json) {
      const riskMultipliers = typeof rateCard.risk_multipliers_json === 'string'
        ? JSON.parse(rateCard.risk_multipliers_json)
        : rateCard.risk_multipliers_json;

      riskMult = riskMultipliers[risk_key] || 1.0;
    }

    // Applica moltiplicatori
    const multipliedCents = Math.round(subtotalCents * seasonalMult * riskMult);

    // Applica min_charge
    const totalCents = Math.max(multipliedCents, rateCard.min_charge_cents);

    // Risposta
    return c.json({
      currency: 'EUR',
      total_estimated_cents: totalCents,
      breakdown: {
        baseCents,
        travelCents,
        subtotalCents,
        seasonalMult,
        riskMult,
        multipliedCents,
        minCharge: rateCard.min_charge_cents,
        totalCents
      },
      pricing_snapshot_json: {
        seller_org_id,
        service_type,
        area_ha,
        distance_km,
        risk_key,
        month,
        rate_card: rateCard
      }
    });

  } catch (error: any) {
    console.error('Error in quote-estimate:', error);
    return c.json({
      error: 'Failed to calculate quote estimate',
      details: error.message
    }, 500);
  }
});

export default app;
