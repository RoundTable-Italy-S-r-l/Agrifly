import { Hono } from "hono";
import { query } from "../utils/database";
import { expandRateCardsTable } from "../utils/database-migrations";
import {
  validateQuery,
  CertifiedQuotesRequestSchema,
} from "../schemas/api.schemas";
import { validateQuery as validateQueryMiddleware } from "../middleware/validation";

const app = new Hono();

/**
 * GET /api/certified-quotes
 * Get immediate quotes from certified operators for a job
 *
 * Query params:
 * - service_type: 'IRRORAZIONE' | 'SPANDIMENTO' | 'RILIEVO_AEREO' | 'SOLLEVAMENTO'
 * - area_ha: number
 * - location_lat: number (job location latitude)
 * - location_lng: number (job location longitude)
 * - terrain_conditions?: 'FLAT' | 'HILLY' | 'MOUNTAINOUS'
 * - crop_type?: string
 * - treatment_type?: string
 */
app.get(
  "/",
  validateQueryMiddleware(CertifiedQuotesRequestSchema),
  async (c) => {
    try {
      // Get validated and transformed query parameters
      const validatedQuery = c.get("validatedQuery") as any;
      const {
        service_type,
        area_ha,
        location_lat,
        location_lng,
        terrain_conditions = "FLAT",
        month = new Date().getMonth() + 1,
      } = validatedQuery;

      console.log("🔍 [CERTIFIED QUOTES] Validated query:", validatedQuery);

      // Ensure rate_cards table has latest columns
      try {
        await expandRateCardsTable();
      } catch (error: any) {
        console.warn("⚠️  Migration warning (non-critical):", error.message);
      }

      // Check if organizations table has is_certified column
      // If not, we'll handle it gracefully
      let hasCertifiedColumn = true;
      try {
        await query("SELECT is_certified FROM organizations LIMIT 1");
      } catch (error: any) {
        console.warn(
          "⚠️  is_certified column not found, skipping certified filter",
        );
        hasCertifiedColumn = false;
      }

      // Check if rate_cards table has is_active column
      let hasIsActiveColumn = true;
      try {
        await query("SELECT is_active FROM rate_cards LIMIT 1");
      } catch (error: any) {
        console.warn(
          "⚠️  is_active column not found in rate_cards, skipping is_active filter",
        );
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
        WHERE (o.is_certified = true OR o.type = 'operator' OR o.type = 'vendor')
          AND o.status = 'ACTIVE'
          AND rc.service_type = $1
          ${hasIsActiveColumn ? "AND (rc.is_active = true OR rc.is_active IS NULL)" : ""}
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
        WHERE (o.type = 'operator' OR o.type = 'vendor')
          AND o.status = 'ACTIVE'
          AND rc.service_type = $1
          ${hasIsActiveColumn ? "AND (rc.is_active = true OR rc.is_active IS NULL)" : ""}
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
            if (
              location_lat &&
              location_lng &&
              org.base_location_lat &&
              org.base_location_lng
            ) {
              const R = 6371; // Earth radius in km
              const dLat =
                ((location_lat - org.base_location_lat) * Math.PI) / 180;
              const dLon =
                ((location_lng - org.base_location_lng) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((org.base_location_lat * Math.PI) / 180) *
                  Math.cos((location_lat * Math.PI) / 180) *
                  Math.sin(dLon / 2) *
                  Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              distanceKm = R * c;
            }

            // Determine terrain conditions
            const is_hilly_terrain =
              terrain_conditions === "HILLY" ||
              terrain_conditions === "MOUNTAINOUS";
            const has_obstacles = false; // Could be extracted from job constraints if needed

            // Parse JSON fields
            let seasonalMultipliers = {};
            try {
              if (org.seasonal_multipliers_json) {
                seasonalMultipliers =
                  typeof org.seasonal_multipliers_json === "string"
                    ? JSON.parse(org.seasonal_multipliers_json)
                    : org.seasonal_multipliers_json;
              }
            } catch (e) {
              console.warn(
                `⚠️ [CERTIFIED QUOTES] Error parsing seasonal_multipliers_json for org ${org.id}:`,
                e,
              );
              seasonalMultipliers = {};
            }

            let riskMultipliers = {};
            try {
              if (org.risk_multipliers_json) {
                riskMultipliers =
                  typeof org.risk_multipliers_json === "string"
                    ? JSON.parse(org.risk_multipliers_json)
                    : org.risk_multipliers_json;
              }
            } catch (e) {
              console.warn(
                `⚠️ [CERTIFIED QUOTES] Error parsing risk_multipliers_json for org ${org.id}:`,
                e,
              );
              riskMultipliers = {};
            }

            let storedCustomMultipliers = {};
            try {
              if (org.custom_multipliers_json) {
                storedCustomMultipliers =
                  typeof org.custom_multipliers_json === "string"
                    ? JSON.parse(org.custom_multipliers_json)
                    : org.custom_multipliers_json;
              }
            } catch (e) {
              console.warn(
                `⚠️ [CERTIFIED QUOTES] Error parsing custom_multipliers_json for org ${org.id}:`,
                e,
              );
              storedCustomMultipliers = {};
            }

            let storedCustomSurcharges = {};
            try {
              if (org.custom_surcharges_json) {
                storedCustomSurcharges =
                  typeof org.custom_surcharges_json === "string"
                    ? JSON.parse(org.custom_surcharges_json)
                    : org.custom_surcharges_json;
              }
            } catch (e) {
              console.warn(
                `⚠️ [CERTIFIED QUOTES] Error parsing custom_surcharges_json for org ${org.id}:`,
                e,
              );
              storedCustomSurcharges = {};
            }

            // Calculate base service cost (area × base_rate_per_ha)
            // Assicurati che base_rate_per_ha_cents sia un numero valido
            const baseRatePerHaCentsRaw = org.base_rate_per_ha_cents;
            let baseRatePerHaCents = 0;

            if (typeof baseRatePerHaCentsRaw === "string") {
              baseRatePerHaCents = parseInt(baseRatePerHaCentsRaw, 10);
            } else if (typeof baseRatePerHaCentsRaw === "number") {
              baseRatePerHaCents = Math.round(baseRatePerHaCentsRaw);
            }

            // Validazione: se il valore è troppo grande o NaN, usa un default
            if (
              isNaN(baseRatePerHaCents) ||
              baseRatePerHaCents < 0 ||
              baseRatePerHaCents > 1000000
            ) {
              console.error(
                "❌ [CERTIFIED QUOTES] Invalid base_rate_per_ha_cents:",
                baseRatePerHaCentsRaw,
                "for org:",
                org.id,
              );
              baseRatePerHaCents = 5000; // Default: 50 euro/ha in centesimi
            }

            console.log("💰 [CERTIFIED QUOTES] Price calculation:", {
              area_ha,
              baseRatePerHaCents,
              baseRatePerHaCentsRaw: org.base_rate_per_ha_cents,
              org_id: org.id,
              org_name: org.legal_name,
            });

            // Calcola baseCents con validazione
            const baseCents = Math.round(area_ha * baseRatePerHaCents);

            // Validazione: se baseCents è troppo grande, c'è un problema
            if (baseCents > 1000000000) {
              // 10 milioni di euro
              console.error(
                "❌ [CERTIFIED QUOTES] Calculated baseCents too large:",
                baseCents,
                "for org:",
                org.id,
              );
              throw new Error(
                `Invalid price calculation: baseCents=${baseCents}, area_ha=${area_ha}, rate=${baseRatePerHaCents}`,
              );
            }

            // Apply seasonal multiplier
            let seasonalMult = 1.0;
            if (seasonalMultipliers) {
              let season: string | undefined;
              if (month >= 3 && month <= 5) season = "spring";
              else if (month >= 6 && month <= 8) season = "summer";
              else if (month >= 9 && month <= 11) season = "autumn";
              else season = "winter";

              if (season && seasonalMultipliers[season]) {
                seasonalMult = parseFloat(seasonalMultipliers[season]);
              }
            }

            const seasonalAdjustedCents = Math.round(baseCents * seasonalMult);

            // Apply terrain multipliers
            let terrainMult = 1.0;
            const terrainMultipliers: Record<string, number> = {
              ...storedCustomMultipliers,
            };

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
              if (key !== "obstacles" && typeof value === "number") {
                terrainMult *= value;
              }
            });

            const multipliedCents = Math.round(
              seasonalAdjustedCents * terrainMult,
            );

            // Calculate travel costs
            const travelFixedCents = org.travel_fixed_cents
              ? typeof org.travel_fixed_cents === "string"
                ? parseInt(org.travel_fixed_cents, 10)
                : Math.round(org.travel_fixed_cents)
              : 0;
            const travelRatePerKmCents = org.travel_rate_per_km_cents
              ? typeof org.travel_rate_per_km_cents === "string"
                ? parseInt(org.travel_rate_per_km_cents, 10)
                : Math.round(org.travel_rate_per_km_cents)
              : 0;

            // Validazione valori travel
            const safeTravelFixedCents =
              isNaN(travelFixedCents) ||
              travelFixedCents < 0 ||
              travelFixedCents > 1000000
                ? 0
                : travelFixedCents;
            const safeTravelRatePerKmCents =
              isNaN(travelRatePerKmCents) ||
              travelRatePerKmCents < 0 ||
              travelRatePerKmCents > 100000
                ? 0
                : travelRatePerKmCents;

            const travelVariableCents = Math.round(
              distanceKm * safeTravelRatePerKmCents,
            );
            const travelCents = safeTravelFixedCents + travelVariableCents;

            // Calculate surcharges
            let surchargesCents = 0;

            // Hilly terrain surcharge
            if (is_hilly_terrain && org.hilly_terrain_surcharge_cents) {
              surchargesCents += parseInt(org.hilly_terrain_surcharge_cents);
            }

            // Custom surcharges
            Object.values(storedCustomSurcharges).forEach((value) => {
              if (typeof value === "number") {
                surchargesCents += Math.round(value);
              }
            });

            // Calculate subtotal and apply minimum charge
            const subtotalCents =
              multipliedCents + travelCents + surchargesCents;
            const minChargeCentsRaw = org.min_charge_cents;
            const minChargeCents = minChargeCentsRaw
              ? typeof minChargeCentsRaw === "string"
                ? parseInt(minChargeCentsRaw, 10)
                : Math.round(minChargeCentsRaw)
              : 0;
            const safeMinChargeCents =
              isNaN(minChargeCents) ||
              minChargeCents < 0 ||
              minChargeCents > 1000000
                ? 0
                : minChargeCents;
            const totalCents = Math.max(subtotalCents, safeMinChargeCents);

            // Validazione finale: se totalCents è troppo grande, c'è un problema
            if (totalCents > 1000000000) {
              // 10 milioni di euro
              console.error(
                "❌ [CERTIFIED QUOTES] Calculated totalCents too large:",
                totalCents,
                "for org:",
                org.id,
              );
              throw new Error(
                `Invalid total price calculation: totalCents=${totalCents}`,
              );
            }

            console.log("💰 [CERTIFIED QUOTES] Final calculation:", {
              org_name: org.legal_name,
              baseCents,
              multipliedCents,
              travelCents,
              surchargesCents,
              subtotalCents,
              minChargeCents,
              totalCents,
              totalCentsInEuros: totalCents / 100,
            });

            return {
              org_id: org.id,
              org_name: org.legal_name,
              logo_url: org.logo_url || null,
              total_cents: totalCents,
              distance_km: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
              rate_card_id: org.rate_card_id,
            };
          } catch (error: any) {
            console.error(
              `❌ Error calculating quote for org ${org.id} (${org.legal_name}):`,
              error.message,
              error.stack,
            );
            return null; // Skip this org if calculation fails
          }
        }),
      );

      // Filter out null results and group by operator, keeping only the cheapest quote per operator
      const validQuotes = quotes.filter(
        (q): q is NonNullable<typeof q> => q !== null,
      );

      // Group by org_id and keep the cheapest quote for each operator
      const quotesByOperator = new Map<string, any>();
      for (const quote of validQuotes) {
        const existing = quotesByOperator.get(quote.org_id);
        if (!existing || quote.total_cents < existing.total_cents) {
          quotesByOperator.set(quote.org_id, quote);
        }
      }

      // Convert back to array and sort by price (ascending)
      const finalQuotes = Array.from(quotesByOperator.values()).sort(
        (a, b) => a.total_cents - b.total_cents,
      );

      return c.json({ quotes: finalQuotes });
    } catch (error: any) {
      console.error("❌ Error fetching certified quotes:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error.message,
        },
        500,
      );
    }
  },
);

export default app;
