import { Hono } from "hono";
import { query } from "../utils/database";

const app = new Hono();

// ============================================================================
// MISSIONS STATS
// ============================================================================

app.get("/stats", async (c) => {
  try {
    const orgId = c.req.query("orgId");

    if (!orgId) {
      return c.json({ error: "orgId parameter required" }, 400);
    }

    console.log("📊 Richiesta statistiche missioni per org:", orgId);

    // Query per ottenere le statistiche delle missioni
    // Nota: La tabella missions attuale ha una struttura diversa, restituiamo valori di default
    const statsQuery = `
      SELECT
        COUNT(*) as total_missions,
        0 as active_missions,
        0 as completed_this_month,
        COALESCE(SUM(actual_area_ha), 0) as total_area_treated
      FROM missions m
      JOIN booking_slots bs ON m.booking_slot_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      WHERE b.buyer_org_id = $1 OR b.seller_org_id = $1
    `;

    const result = await query(statsQuery, [orgId]);

    // Se non ci sono missioni, restituisci valori di default
    if (result.rows.length === 0) {
      return c.json({
        totalMissions: 0,
        activeMissions: 0,
        completedThisMonth: 0,
        totalAreaTreated: 0,
      });
    }

    const stats = result.rows[0];

    const response = {
      totalMissions: parseInt(stats.total_missions) || 0,
      activeMissions: parseInt(stats.active_missions) || 0,
      completedThisMonth: parseInt(stats.completed_this_month) || 0,
      totalAreaTreated: parseFloat(stats.total_area_treated) || 0,
    };

    console.log("✅ Statistiche missioni calcolate:", response);

    return c.json(response);
  } catch (error: any) {
    console.error("❌ Errore get missions stats:", error);
    return c.json(
      {
        error: "Errore interno",
        message: error.message,
      },
      500,
    );
  }
});

// ============================================================================
// ACTIVE MISSIONS
// ============================================================================

app.get("/active", async (c) => {
  try {
    const orgId = c.req.query("orgId");

    if (!orgId) {
      return c.json({ error: "orgId parameter required" }, 400);
    }

    console.log("🎯 Richiesta missioni attive per org:", orgId);

    // Query per ottenere le missioni attive
    // Adattata alla struttura reale della tabella missions
    const activeMissionsQuery = `
      SELECT
        m.id,
        'Missione ' || m.id as name,
        CASE
          WHEN m.executed_end_at IS NULL THEN 'in_progress'
          ELSE 'completed'
        END as status,
        m.actual_area_ha as area_treated_ha,
        m.actual_hours as estimated_duration_hours,
        NULL as assigned_operator_id,
        m.executed_start_at as scheduled_date,
        m.executed_start_at as started_at,
        m.executed_end_at as completed_at,
        m.id as created_at
      FROM missions m
      JOIN booking_slots bs ON m.booking_slot_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      WHERE (b.buyer_org_id = $1 OR b.seller_org_id = $1)
      AND m.executed_end_at IS NULL
      ORDER BY m.id DESC
      LIMIT 10
    `;

    const result = await query(activeMissionsQuery, [orgId]);

    console.log("✅ Missioni attive recuperate:", result.rows.length);

    return c.json(result.rows || []);
  } catch (error: any) {
    console.error("❌ Errore get active missions:", error);
    return c.json(
      {
        error: "Errore interno",
        message: error.message,
      },
      500,
    );
  }
});

// ============================================================================
// MISSIONS LIST
// ============================================================================

app.get("/", async (c) => {
  try {
    const orgId = c.req.query("orgId");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    if (!orgId) {
      return c.json({ error: "orgId parameter required" }, 400);
    }

    console.log(
      "📋 Richiesta lista missioni per org:",
      orgId,
      "limit:",
      limit,
      "offset:",
      offset,
    );

    // Query per ottenere la lista delle missioni
    // Adattata alla struttura reale della tabella missions
    const missionsQuery = `
      SELECT
        m.id,
        'Missione ' || m.id as name,
        CASE
          WHEN m.executed_end_at IS NULL THEN 'in_progress'
          ELSE 'completed'
        END as status,
        m.actual_area_ha as area_treated_ha,
        m.actual_hours as estimated_duration_hours,
        NULL as assigned_operator_id,
        m.executed_start_at as scheduled_date,
        m.executed_start_at as started_at,
        m.executed_end_at as completed_at,
        m.id as created_at
      FROM missions m
      JOIN booking_slots bs ON m.booking_slot_id = bs.id
      JOIN bookings b ON bs.booking_id = b.id
      WHERE (b.buyer_org_id = $1 OR b.seller_org_id = $1)
      ORDER BY m.id DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(missionsQuery, [orgId, limit, offset]);

    console.log("✅ Missioni recuperate:", result.rows.length);

    return c.json(result.rows || []);
  } catch (error: any) {
    console.error("❌ Errore get missions:", error);
    return c.json(
      {
        error: "Errore interno",
        message: error.message,
      },
      500,
    );
  }
});

export default app;
