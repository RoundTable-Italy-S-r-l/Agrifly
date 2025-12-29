import { Hono } from 'hono';
import { query } from '../utils/database';
import { expandRateCardsTable } from '../utils/database-migrations';

const app = new Hono();

/**
 * POST /api/quote-estimate
 * Calculate quote/estimate based on rate_card for a specific job
 * 
 * Request body:
 * {
 *   seller_org_id: string,
 *   service_type: 'SPRAY' | 'SPREAD' | 'MAPPING',
 *   area_ha: number,
 *   distance_km: number,
 *   is_hilly_terrain?: boolean,
 *   has_obstacles?: boolean,
 *   custom_multipliers?: Record<string, number>,
 *   custom_surcharges?: Record<string, number>,
 *   month?: number (1-12, for seasonal multipliers)
 * }
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      seller_org_id,
      service_type,
      area_ha,
      distance_km,
      is_hilly_terrain = false,
      has_obstacles = false,
      custom_multipliers = {},
      custom_surcharges = {},
      month = new Date().getMonth() + 1
    } = body;

    if (!seller_org_id || !service_type || !area_ha) {
      return c.json({ error: 'seller_org_id, service_type, and area_ha are required' }, 400);
    }

    // Ensure rate_cards table has latest columns
    try {
      await expandRateCardsTable();
    } catch (error: any) {
      console.warn('⚠️  Migration warning (non-critical):', error.message);
    }

    // Fetch rate card for this service type
    const rateCardResult = await query(`
      SELECT
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_fixed_cents,
        travel_rate_per_km_cents,
        hilly_terrain_multiplier,
        hilly_terrain_surcharge_cents,
        custom_multipliers_json,
        custom_surcharges_json,
        seasonal_multipliers_json,
        risk_multipliers_json
      FROM rate_cards
      WHERE seller_org_id = $1 AND service_type = $2
    `, [seller_org_id, service_type]);

    if (rateCardResult.rows.length === 0) {
      return c.json({ error: 'Rate card not found for this service type' }, 404);
    }

    const rateCard = rateCardResult.rows[0];

    // Parse JSON fields
    const seasonalMultipliers = rateCard.seasonal_multipliers_json
      ? (typeof rateCard.seasonal_multipliers_json === 'string'
          ? JSON.parse(rateCard.seasonal_multipliers_json)
          : rateCard.seasonal_multipliers_json)
      : {};

    const riskMultipliers = rateCard.risk_multipliers_json
      ? (typeof rateCard.risk_multipliers_json === 'string'
          ? JSON.parse(rateCard.risk_multipliers_json)
          : rateCard.risk_multipliers_json)
      : {};

    const storedCustomMultipliers = rateCard.custom_multipliers_json
      ? (typeof rateCard.custom_multipliers_json === 'string'
          ? JSON.parse(rateCard.custom_multipliers_json)
          : rateCard.custom_multipliers_json)
      : {};

    const storedCustomSurcharges = rateCard.custom_surcharges_json
      ? (typeof rateCard.custom_surcharges_json === 'string'
          ? JSON.parse(rateCard.custom_surcharges_json)
          : rateCard.custom_surcharges_json)
      : {};

    // Calculate base service cost (area × base_rate_per_ha)
    const baseRatePerHaCents = parseInt(rateCard.base_rate_per_ha_cents);
    const baseCents = Math.round(area_ha * baseRatePerHaCents);

    // Apply seasonal multiplier (if available)
    let seasonalMult = 1.0;
    if (seasonalMultipliers) {
      // Determine season from month
      let season: string | undefined;
      if (month >= 3 && month <= 5) season = 'spring';
      else if (month >= 6 && month <= 8) season = 'summer';
      else if (month >= 9 && month <= 11) season = 'autumn';
      else season = 'winter';

      if (season && seasonalMultipliers[season]) {
        seasonalMult = parseFloat(seasonalMultipliers[season]);
      }
    }

    const seasonalAdjustedCents = Math.round(baseCents * seasonalMult);

    // Apply terrain multipliers
    let terrainMult = 1.0;
    const terrainMultipliers: Record<string, number> = { ...storedCustomMultipliers, ...custom_multipliers };

    // Hilly terrain multiplier
    if (is_hilly_terrain && rateCard.hilly_terrain_multiplier) {
      terrainMult *= parseFloat(rateCard.hilly_terrain_multiplier);
    }

    // Apply custom multipliers (obstacles, etc.)
    if (has_obstacles && terrainMultipliers.obstacles) {
      terrainMult *= parseFloat(terrainMultipliers.obstacles);
    }

    // Apply any other custom multipliers
    Object.entries(terrainMultipliers).forEach(([key, value]) => {
      if (key !== 'obstacles' && typeof value === 'number') {
        terrainMult *= value;
      }
    });

    const multipliedCents = Math.round(seasonalAdjustedCents * terrainMult);

    // Calculate travel costs (fixed + variable per km)
    const travelFixedCents = rateCard.travel_fixed_cents ? parseInt(rateCard.travel_fixed_cents) : 0;
    const travelRatePerKmCents = rateCard.travel_rate_per_km_cents ? parseInt(rateCard.travel_rate_per_km_cents) : 0;
    const travelVariableCents = Math.round(distance_km * travelRatePerKmCents);
    const travelCents = travelFixedCents + travelVariableCents;

    // Calculate surcharges
    let surchargesCents = 0;

    // Hilly terrain surcharge
    if (is_hilly_terrain && rateCard.hilly_terrain_surcharge_cents) {
      surchargesCents += parseInt(rateCard.hilly_terrain_surcharge_cents);
    }

    // Custom surcharges (from rate card + request)
    // storedCustomSurcharges are already in cents (from database JSON)
    Object.values(storedCustomSurcharges).forEach((value) => {
      if (typeof value === 'number') {
        surchargesCents += Math.round(value); // Already in cents from database
      }
    });
    
    // custom_surcharges from request might be in euros, convert to cents
    Object.values(custom_surcharges).forEach((value) => {
      if (typeof value === 'number') {
        // Assume values from API request are in euros, convert to cents
        surchargesCents += Math.round(value * 100);
      }
    });

    // Calculate subtotal and apply minimum charge
    const subtotalCents = multipliedCents + travelCents + surchargesCents;
    const minChargeCents = parseInt(rateCard.min_charge_cents);
    const totalCents = Math.max(subtotalCents, minChargeCents);

    // Build breakdown
    const breakdown = {
      baseCents,
      baseRatePerHaCents,
      areaHa: area_ha,
      seasonalMult,
      seasonalAdjustedCents,
      terrainMult,
      multipliedCents,
      travelFixedCents,
      travelVariableCents,
      travelCents,
      surchargesCents,
      subtotalCents,
      minChargeCents,
      totalCents
    };

    // Build pricing snapshot for storage
    const pricingSnapshot = {
      input: {
        seller_org_id,
        service_type,
        area_ha,
        distance_km,
        is_hilly_terrain,
        has_obstacles,
        month
      },
      rateCard: {
        base_rate_per_ha_cents: baseRatePerHaCents,
        min_charge_cents: minChargeCents,
        travel_fixed_cents: travelFixedCents,
        travel_rate_per_km_cents: travelRatePerKmCents,
        hilly_terrain_multiplier: rateCard.hilly_terrain_multiplier,
        hilly_terrain_surcharge_cents: rateCard.hilly_terrain_surcharge_cents
      },
      calculation: breakdown
    };

    return c.json({
      total_estimated_cents: totalCents,
      breakdown,
      pricing_snapshot_json: pricingSnapshot
    });

  } catch (error: any) {
    console.error('❌ Error calculating quote estimate:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

export default app;

