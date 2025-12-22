import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Input = z.object({
  seller_org_id: z.string().min(1),
  service_type: z.string().min(1), // deve matchare rate_cards.service_type
  area_ha: z.number().positive(),
  distance_km: z.number().min(0).default(0),

  // opzionali, iniziamo semplice
  risk_key: z.string().optional(),
  month: z.number().int().min(1).max(12).optional(),
});

function serverSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing SUPABASE env vars");
  return createClient(url, serviceRole);
}

function pickMultiplier(json: any, key?: string, fallback = 1) {
  if (!json || !key) return fallback;
  const n = Number(json[key]);
  return Number.isFinite(n) ? n : fallback;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const input = Input.parse(JSON.parse(event.body || "{}"));
    const supabase = serverSupabase();

    const { data: rateCard, error } = await supabase
      .from("rate_cards")
      .select("*")
      .eq("seller_org_id", input.seller_org_id)
      .eq("service_type", input.service_type)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!rateCard) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing rate_cards for seller_org_id + service_type" }),
      };
    }

    const baseRatePerHa = Number(rateCard.base_rate_per_ha_cents ?? 0);
    const minCharge = Number(rateCard.min_charge_cents ?? 0);
    const travelRatePerKm = Number(rateCard.travel_rate_per_km_cents ?? 0);

    const baseCents = Math.round(baseRatePerHa * input.area_ha);
    const travelCents = Math.round(travelRatePerKm * input.distance_km);
    const subtotalCents = baseCents + travelCents;

    const monthKey = input.month ? String(input.month) : undefined;
    const seasonalMult = pickMultiplier(rateCard.seasonal_multipliers_json, monthKey, 1);
    const riskMult = pickMultiplier(rateCard.risk_multipliers_json, input.risk_key, 1);

    const multipliedCents = Math.round(subtotalCents * seasonalMult * riskMult);
    const totalCents = Math.max(minCharge, multipliedCents);

    const breakdown = {
      baseCents,
      travelCents,
      subtotalCents,
      seasonalMult,
      riskMult,
      multipliedCents,
      minCharge,
      totalCents,
    };

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currency: "EUR",
        total_estimated_cents: totalCents,
        breakdown,
        pricing_snapshot_json: {
          input,
          rate_card_id: rateCard.id,
          rate_card: {
            base_rate_per_ha_cents: baseRatePerHa,
            min_charge_cents: minCharge,
            travel_rate_per_km_cents: travelRatePerKm,
          },
          breakdown,
          version: "pricing_v2_rate_cards_mvp_001",
          computed_at: new Date().toISOString(),
        },
      }),
    };
  } catch (e: any) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e?.message ?? "Unknown error" }),
    };
  }
};
