import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Import delle routes (usa database SQLite/PostgreSQL)
import authRoutes from "./routes/auth-hono";
import demoRoutes from "./routes/demo-hono";
import dronesRoutes from "./routes/drones-hono";
import cropsRoutes from "./routes/crops-hono";
import treatmentsRoutes from "./routes/treatments-hono";
import affiliatesRoutes from "./routes/affiliates-hono";
import fieldsRoutes from "./routes/fields-hono";
import gisCategoriesRoutes from "./routes/gis-categories-hono";
import ordersRoutes from "./routes/orders-hono";
import missionsRoutes from "./routes/missions-hono";
import catalogRoutes from "./routes/catalog-hono";
import offersRoutes from "./routes/offers-hono";
import servicesRoutes from "./routes/services-hono";
import operatorsRoutes from "./routes/operators-hono";
import ecommerceRoutes from "./routes/ecommerce-hono";
import routingRoutes from "./routes/routing-hono";
import settingsRoutes from "./routes/settings-hono";
import bookingsRoutes from "./routes/bookings-hono";
// import settingsRoutes from './routes/settings-hono';
import jobsRoutes from "./routes/jobs-hono";
import savedFieldsRoutes from "./routes/saved-fields-hono";
import quoteEstimateRoutes from "./routes/quote-estimate-hono";
import certifiedQuotesRoutes from "./routes/certified-quotes-hono";
import voiceAssistantRoutes from "./routes/voice-assistant-hono";

// Import utilities for offers alias route
import { authMiddleware } from "./middleware/auth";
import { query } from "./utils/database";

// Crea app Hono
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Logging middleware per debug (come Express)
app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api/")) {
    console.log(`📡 ${c.req.method} ${c.req.path}`);
    console.log(
      `🔍 [GLOBAL MIDDLEWARE] Path: ${c.req.path}, URL: ${c.req.url}`,
    );
    console.log(
      `🔍 [GLOBAL MIDDLEWARE] Has Auth Header: ${!!c.req.header("Authorization")}`,
    );
  }
  await next();
});

// Monta le routes
app.route("/api/auth", authRoutes);
app.route("/api/demo", demoRoutes);
app.route("/api/drones", dronesRoutes);
app.route("/api/crops", cropsRoutes);
app.route("/api/treatments", treatmentsRoutes);
app.route("/api/affiliates", affiliatesRoutes);
app.route("/api/fields", fieldsRoutes);
app.route("/api/gis-categories", gisCategoriesRoutes);
app.route("/api/orders", ordersRoutes);
app.route("/api/missions", missionsRoutes);
app.route("/api/catalog", catalogRoutes);
app.route("/api/offers", offersRoutes); // Enabled for bundle offers
app.route("/api/services", servicesRoutes);
app.route("/api/operators", operatorsRoutes);
app.route("/api/ecommerce", ecommerceRoutes);
app.route("/api/routing", routingRoutes);
app.route("/api/service-config", settingsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/bookings", bookingsRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/quote-estimate", quoteEstimateRoutes);
app.route("/api/certified-quotes", certifiedQuotesRoutes);
app.route("/api/voice-assistant", voiceAssistantRoutes);

// Saved fields routes
app.route("/api/saved-fields", savedFieldsRoutes);

// Offers routes - create alias for /api/offers/:orgId -> /api/jobs/offers/:orgId
// Create a handler that duplicates the logic from jobs-hono.ts /offers/:orgId
// This allows /api/offers/:orgId to work directly (for backward compatibility or frontend calls)
app.get("/api/offers/:orgId", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const orgId = c.req.param("orgId");

    console.log(
      "🎁 [ALIAS /api/offers/:orgId] Richiesta job offers per org:",
      orgId,
      "user org:",
      user?.organizationId,
    );

    // Users can only see offers for their own organization
    if (!user || user.organizationId !== orgId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Get offers received (where user's org is the buyer)
    const receivedOffersResult = await query(
      `
      SELECT 
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        j.field_name, j.service_type, j.area_ha, j.location_json,
        j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
        j.buyer_org_id,
        buyer_org.legal_name as buyer_org_legal_name,
        operator_org.legal_name as operator_org_legal_name
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE j.buyer_org_id = $1
      ORDER BY jo.created_at DESC
    `,
      [orgId],
    );

    // Get offers made (where user's org is the operator)
    const madeOffersResult = await query(
      `
      SELECT 
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        j.field_name, j.service_type, j.area_ha, j.location_json,
        j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
        j.buyer_org_id,
        buyer_org.legal_name as buyer_org_legal_name,
        operator_org.legal_name as operator_org_legal_name
      FROM job_offers jo
      LEFT JOIN jobs j ON jo.job_id = j.id
      LEFT JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE jo.operator_org_id = $1
      ORDER BY jo.created_at DESC
    `,
      [orgId],
    );

    // Format received offers
    const received = receivedOffersResult.rows.map((row: any) => {
      const locJson = row.location_json
        ? typeof row.location_json === "string"
          ? JSON.parse(row.location_json)
          : row.location_json
        : null;
      return {
        id: row.id,
        job_id: row.job_id,
        operator_org_id: row.operator_org_id,
        status: row.status,
        pricing_snapshot_json: row.pricing_snapshot_json
          ? typeof row.pricing_snapshot_json === "string"
            ? JSON.parse(row.pricing_snapshot_json)
            : row.pricing_snapshot_json
          : null,
        total_cents: parseInt(row.total_cents) || 0,
        currency: row.currency || "EUR",
        proposed_start: row.proposed_start,
        proposed_end: row.proposed_end,
        provider_note: row.provider_note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        job: {
          id: row.job_id,
          field_name: row.field_name,
          service_type: row.service_type,
          area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
          location_json: locJson,
          field_polygon:
            locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
          target_date_start: row.target_date_start,
          target_date_end: row.target_date_end,
          notes: row.notes,
          status: row.job_status,
          buyer_org: {
            id: row.buyer_org_id || null,
            legal_name: row.buyer_org_legal_name || "N/A",
          },
        },
        operator_org: {
          id: row.operator_org_id,
          legal_name: row.operator_org_legal_name || "N/A",
        },
      };
    });

    // Format made offers
    const made = madeOffersResult.rows.map((row: any) => {
      const locJson = row.location_json
        ? typeof row.location_json === "string"
          ? JSON.parse(row.location_json)
          : row.location_json
        : null;
      return {
        id: row.id,
        job_id: row.job_id,
        operator_org_id: row.operator_org_id,
        status: row.status,
        pricing_snapshot_json: row.pricing_snapshot_json
          ? typeof row.pricing_snapshot_json === "string"
            ? JSON.parse(row.pricing_snapshot_json)
            : row.pricing_snapshot_json
          : null,
        total_cents: parseInt(row.total_cents) || 0,
        currency: row.currency || "EUR",
        proposed_start: row.proposed_start,
        proposed_end: row.proposed_end,
        provider_note: row.provider_note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        job: row.job_id
          ? {
              id: row.job_id,
              field_name: row.field_name || null,
              service_type: row.service_type || null,
              area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
              location_json: locJson,
              field_polygon:
                locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
              target_date_start: row.target_date_start,
              target_date_end: row.target_date_end,
              notes: row.notes,
              status: row.job_status || null,
              buyer_org: {
                id: row.buyer_org_id || null,
                legal_name: row.buyer_org_legal_name || "N/A",
              },
            }
          : null,
        operator_org: {
          id: row.operator_org_id,
          legal_name: row.operator_org_legal_name || "N/A",
        },
      };
    });

    console.log(
      `✅ [ALIAS /api/offers/:orgId] Job offers trovate: received=${received.length}, made=${made.length}`,
    );

    return c.json({ received, made });
  } catch (error: any) {
    console.error(
      "❌ [ALIAS /api/offers/:orgId] Error fetching job offers:",
      error,
    );
    return c.json(
      { error: "Internal server error", message: error.message },
      500,
    );
  }
});

// Remove the duplicate route mounting that was causing conflicts
// app.route('/api/offers', jobsRoutes); // REMOVED - using direct handler above instead

// Debug endpoint to check auth headers
app.get("/api/debug-auth", async (c) => {
  const authHeader = c.req.header("Authorization");
  return c.json({
    hasAuthHeader: !!authHeader,
    authHeader: authHeader ? authHeader.substring(0, 50) + "..." : null,
    timestamp: new Date().toISOString(),
  });
});

// Health check globale (compatibilità)
app.get("/api/health", async (c) => {
  try {
    const { query } = await import("./utils/database");
    // Test semplice connessione
    const result = await query("SELECT 1 as test");
    console.log("Health check result:", result.rows);

    return c.json({
      timestamp: new Date().toISOString(),
      status: "ok",
      database: "connected",
      environment: process.env.NODE_ENV,
      test_result: result.rows[0],
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return c.json(
      {
        status: "error",
        database: "disconnected",
        error: error.message,
        stack: error.stack?.substring(0, 200),
      },
      500,
    );
  }
});

// Error handler globale
app.onError((err, c) => {
  console.error("❌ Global error handler:", err);
  console.error("❌ Error message:", err.message);
  console.error("❌ Error stack:", err.stack);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
    500,
  );
});

// 404 handler
app.notFound((c) => {
  console.log("❌ Route not found:", c.req.path);
  return c.json({ error: "Route not found" }, 404);
});

export default app;
