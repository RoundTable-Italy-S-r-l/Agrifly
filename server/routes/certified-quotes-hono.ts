import { Hono } from 'hono';
import { query } from '../utils/database';
import { expandRateCardsTable } from '../utils/database-migrations';

const app = new Hono();

/**
 * GET /api/certified-quotes
 * Get immediate quotes from certified operators for a job
 * 
 * Query params:
 * - service_type: 'SPRAY' | 'SPREAD' | 'MAPPING'
 * - area_ha: number
 * - location_lat: number (job location latitude)
 * - location_lng: number (job location longitude)
 * - terrain_conditions?: 'FLAT' | 'HILLY' | 'MOUNTAINOUS'
 * - crop_type?: string
 * - treatment_type?: string
 */
app.get('/', async (c) => {
  try {
    const service_type = c.req.query('service_type');
    const area_ha = parseFloat(c.req.query('area_ha') || '0');
    const location_lat = parseFloat(c.req.query('location_lat') || '0');
    const location_lng = parseFloat(c.req.query('location_lng') || '0');
    const terrain_conditions = c.req.query('terrain_conditions') || 'FLAT';
    const month = parseInt(c.req.query('month') || String(new Date().getMonth() + 1));

    if (!service_type || !area_ha || area_ha <= 0) {
      return c.json({ error: 'service_type and area_ha are required' }, 400);
    }

    // Ensure rate_cards table has latest columns
    try {
      await expandRateCardsTable();
    } catch (error: any) {
      console.warn('⚠️  Migration warning (non-critical):', error.message);
    }

    // Check if organizations table has is_certified column
    // If not, we'll handle it gracefully
    let hasCertifiedColumn = true;
    try {
      await query('SELECT is_certified FROM organizations LIMIT 1');
    } catch (error: any) {
      console.warn('⚠️  is_certified column not found, skipping certified filter');
      hasCertifiedColumn = false;
    }

    // Check if rate_cards table has is_active column
    let hasIsActiveColumn = true;
    try {
      await query('SELECT is_active FROM rate_cards LIMIT 1');
    } catch (error: any) {
      console.warn('⚠️  is_active column not found in rate_cards, skipping is_active filter');
      hasIsActiveColumn = false;
    }

    // Find certified operators with active rate cards for this service type
    const certifiedOrgsQuery = hasCertifiedColumn
      ? `
        SELECT DISTINCT
          o.id,
          o.legal_name,
          o.logo_url,
          sc.base_location_lat,
          sc.base_location_lng,
          rc.id as rate_card_id,
          rc.base_rate_per_ha_cents,
          rc.min_charge_cents,
          rc.travel_fixed_cents,
          rc.travel_rate_per_km_cents,
          rc.hilly_terrain_multiplier,
          rc.hilly_terrain_surcharge_cents,
          rc.custom_multipliers_json,
          rc.custom_surcharges_json,
          rc.seasonal_multipliers_json,
          rc.risk_multipliers_json
        FROM organizations o
        INNER JOIN rate_cards rc ON rc.seller_org_id = o.id
        LEFT JOIN service_configurations sc ON sc.org_id = o.id
        WHERE o.is_certified = true
          AND o.can_operate = true
          AND o.status = 'ACTIVE'
          AND rc.service_type = $1
          ${hasIsActiveColumn ? 'AND (rc.is_active = true OR rc.is_active IS NULL)' : ''}
      `
      : `
        SELECT DISTINCT
          o.id,
          o.legal_name,
          o.logo_url,
          sc.base_location_lat,
          sc.base_location_lng,
          rc.id as rate_card_id,
          rc.base_rate_per_ha_cents,
          rc.min_charge_cents,
          rc.travel_fixed_cents,
          rc.travel_rate_per_km_cents,
          rc.hilly_terrain_multiplier,
          rc.hilly_terrain_surcharge_cents,
          rc.custom_multipliers_json,
          rc.custom_surcharges_json,
          rc.seasonal_multipliers_json,
          rc.risk_multipliers_json
        FROM organizations o
        INNER JOIN rate_cards rc ON rc.seller_org_id = o.id
        LEFT JOIN service_configurations sc ON sc.org_id = o.id
        WHERE o.can_operate = true
          AND o.status = 'ACTIVE'
          AND rc.service_type = $1
          ${hasIsActiveColumn ? 'AND (rc.is_active = true OR rc.is_active IS NULL)' : ''}
      `;

    const orgsResult = await query(certifiedOrgsQuery, [service_type]);

    if (orgsResult.rows.length === 0) {
      return c.json({ quotes: [] });
    }

    // Calculate distance and quote for each certified operator
    const quotes = await Promise.all(
      orgsResult.rows.map(async (org: any) => {
        try {
          // Calculate distance (Haversine formula for approximate distance)
          let distanceKm = 20; // Default fallback
          if (location_lat && location_lng && org.base_location_lat && org.base_location_lng) {
            const R = 6371; // Earth radius in km
            const dLat = (location_lat - org.base_location_lat) * Math.PI / 180;
            const dLon = (location_lng - org.base_location_lng) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(org.base_location_lat * Math.PI / 180) *
              Math.cos(location_lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceKm = R * c;
          }

          // Determine terrain conditions
          const is_hilly_terrain = terrain_conditions === 'HILLY' || terrain_conditions === 'MOUNTAINOUS';
          const has_obstacles = false; // Could be extracted from job constraints if needed

          // Parse JSON fields
          const seasonalMultipliers = org.seasonal_multipliers_json
            ? (typeof org.seasonal_multipliers_json === 'string'
                ? JSON.parse(org.seasonal_multipliers_json)
                : org.seasonal_multipliers_json)
            : {};

          const riskMultipliers = org.risk_multipliers_json
            ? (typeof org.risk_multipliers_json === 'string'
                ? JSON.parse(org.risk_multipliers_json)
                : org.risk_multipliers_json)
            : {};

          const storedCustomMultipliers = org.custom_multipliers_json
            ? (typeof org.custom_multipliers_json === 'string'
                ? JSON.parse(org.custom_multipliers_json)
                : org.custom_multipliers_json)
            : {};

          const storedCustomSurcharges = org.custom_surcharges_json
            ? (typeof org.custom_surcharges_json === 'string'
                ? JSON.parse(org.custom_surcharges_json)
                : org.custom_surcharges_json)
            : {};

          // Calculate base service cost (area × base_rate_per_ha)
          const baseRatePerHaCents = parseInt(org.base_rate_per_ha_cents);
          const baseCents = Math.round(area_ha * baseRatePerHaCents);

          // Apply seasonal multiplier
          let seasonalMult = 1.0;
          if (seasonalMultipliers) {
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
          const terrainMultipliers: Record<string, number> = { ...storedCustomMultipliers };

          // Hilly terrain multiplier
          if (is_hilly_terrain && org.hilly_terrain_multiplier) {
            terrainMult *= parseFloat(org.hilly_terrain_multiplier);
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

          // Calculate travel costs
          const travelFixedCents = org.travel_fixed_cents ? parseInt(org.travel_fixed_cents) : 0;
          const travelRatePerKmCents = org.travel_rate_per_km_cents ? parseInt(org.travel_rate_per_km_cents) : 0;
          const travelVariableCents = Math.round(distanceKm * travelRatePerKmCents);
          const travelCents = travelFixedCents + travelVariableCents;

          // Calculate surcharges
          let surchargesCents = 0;

          // Hilly terrain surcharge
          if (is_hilly_terrain && org.hilly_terrain_surcharge_cents) {
            surchargesCents += parseInt(org.hilly_terrain_surcharge_cents);
          }

          // Custom surcharges
          Object.values(storedCustomSurcharges).forEach((value) => {
            if (typeof value === 'number') {
              surchargesCents += Math.round(value);
            }
          });

          // Calculate subtotal and apply minimum charge
          const subtotalCents = multipliedCents + travelCents + surchargesCents;
          const minChargeCents = parseInt(org.min_charge_cents);
          const totalCents = Math.max(subtotalCents, minChargeCents);

          return {
            org_id: org.id,
            org_name: org.legal_name,
            logo_url: org.logo_url || null,
            total_cents: totalCents,
            distance_km: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
            rate_card_id: org.rate_card_id
          };
        } catch (error: any) {
          console.error(`❌ Error calculating quote for org ${org.id}:`, error);
          return null; // Skip this org if calculation fails
        }
      })
    );

    // Filter out null results and group by operator, keeping only the cheapest quote per operator
    const validQuotes = quotes
      .filter((q): q is NonNullable<typeof q> => q !== null);

    // Group by org_id and keep the cheapest quote for each operator
    const quotesByOperator = new Map<string, any>();
    for (const quote of validQuotes) {
      const existing = quotesByOperator.get(quote.org_id);
      if (!existing || quote.total_cents < existing.total_cents) {
        quotesByOperator.set(quote.org_id, quote);
      }
    }

    // Convert back to array and sort by price (ascending)
    const finalQuotes = Array.from(quotesByOperator.values())
      .sort((a, b) => a.total_cents - b.total_cents);

    return c.json({ quotes: finalQuotes });

  } catch (error: any) {
    console.error('❌ Error fetching certified quotes:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

export default app;

