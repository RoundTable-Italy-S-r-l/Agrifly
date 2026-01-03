const { Client } = require("pg");
require("dotenv/config");

const pgClient = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || "6543"),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkLenziServices() {
  try {
    await pgClient.connect();
    console.log("✅ Connesso a Supabase PostgreSQL\n");

    const lenziOrgId = "lenzi-org-id";

    // 1. Verifica service_configurations
    console.log("🔍 Verificando service_configurations per Lenzi...");
    const serviceConfigs = await pgClient.query(
      `
      SELECT * FROM service_configurations 
      WHERE org_id = $1
    `,
      [lenziOrgId],
    );

    console.log(
      `📊 Service configurations trovate: ${serviceConfigs.rows.length}`,
    );
    if (serviceConfigs.rows.length > 0) {
      serviceConfigs.rows.forEach((config, index) => {
        console.log(`\n  ${index + 1}. Service Configuration ID: ${config.id}`);
        console.log(`     - org_id: ${config.org_id}`);
        console.log(`     - base_location_lat: ${config.base_location_lat}`);
        console.log(`     - base_location_lng: ${config.base_location_lng}`);
        console.log(
          `     - work_start_hour: ${config.work_start_hour || config.working_hours_start || "N/A"}`,
        );
        console.log(
          `     - work_end_hour: ${config.work_end_hour || config.working_hours_end || "N/A"}`,
        );
        console.log(`     - created_at: ${config.created_at}`);
      });
    } else {
      console.log("  ⚠️  Nessuna service_configuration trovata per Lenzi");
    }

    // 2. Verifica rate_cards
    console.log(`\n🔍 Verificando rate_cards per Lenzi...`);
    const rateCards = await pgClient.query(
      `
      SELECT * FROM rate_cards 
      WHERE seller_org_id = $1
    `,
      [lenziOrgId],
    );

    console.log(`📊 Rate cards trovate: ${rateCards.rows.length}`);
    if (rateCards.rows.length > 0) {
      rateCards.rows.forEach((card, index) => {
        console.log(`\n  ${index + 1}. Rate Card ID: ${card.id}`);
        console.log(`     - seller_org_id: ${card.seller_org_id}`);
        console.log(`     - service_type: ${card.service_type}`);
        console.log(
          `     - base_rate_per_ha_cents: ${card.base_rate_per_ha_cents}`,
        );
        console.log(`     - is_active: ${card.is_active}`);
      });
    } else {
      console.log("  ⚠️  Nessuna rate_card trovata per Lenzi");
    }

    // 3. Verifica operator_profiles
    console.log(`\n🔍 Verificando operator_profiles per Lenzi...`);
    const operatorProfiles = await pgClient.query(
      `
      SELECT * FROM operator_profiles 
      WHERE org_id = $1
    `,
      [lenziOrgId],
    );

    console.log(
      `📊 Operator profiles trovati: ${operatorProfiles.rows.length}`,
    );
    if (operatorProfiles.rows.length > 0) {
      operatorProfiles.rows.forEach((profile, index) => {
        console.log(`\n  ${index + 1}. Operator Profile ID: ${profile.id}`);
        console.log(`     - org_id: ${profile.org_id}`);
        console.log(`     - user_id: ${profile.user_id}`);
        console.log(
          `     - certifications_json: ${profile.certifications_json ? "presente" : "N/A"}`,
        );
      });
    } else {
      console.log("  ⚠️  Nessun operator_profile trovato per Lenzi");
    }

    // Riepilogo finale
    console.log(`\n📊 RIEPILOGO FINALE:`);
    console.log(`  - Service configurations: ${serviceConfigs.rows.length}`);
    console.log(`  - Rate cards: ${rateCards.rows.length}`);
    console.log(`  - Operator profiles: ${operatorProfiles.rows.length}`);

    if (serviceConfigs.rows.length === 0 && rateCards.rows.length === 0) {
      console.log(
        `\n⚠️  ATTENZIONE: Nessun servizio trovato per Lenzi su Supabase!`,
      );
      console.log(
        `   Potrebbero essere necessarie per funzionare correttamente.`,
      );
    }
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
  } finally {
    await pgClient.end();
  }
}

checkLenziServices();
