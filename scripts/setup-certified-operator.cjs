const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

// Parametri configurabili
const ORG_ID = process.argv[2]; // Passa l'ID dell'organizzazione come argomento
const SERVICE_TYPES = ["SPRAY", "SPREAD", "MAPPING"]; // Servizi da configurare
const BASE_LAT = 44.4949; // Bologna (esempio)
const BASE_LNG = 11.3426;

async function setupCertifiedOperator() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    if (!ORG_ID) {
      console.log("❌ Errore: Specifica l'ID dell'organizzazione");
      console.log("   Uso: node scripts/setup-certified-operator.cjs <org_id>");
      console.log("\n   Organizzazioni disponibili:");

      const orgs = await client.query(`
        SELECT id, legal_name, can_operate, status
        FROM organizations
        ORDER BY legal_name
      `);

      orgs.rows.forEach((org) => {
        console.log(
          `      - ${org.id}: ${org.legal_name} (can_operate: ${org.can_operate}, status: ${org.status})`,
        );
      });

      await client.end();
      process.exit(1);
    }

    // Verifica che l'organizzazione esista
    const orgCheck = await client.query(
      `
      SELECT id, legal_name, is_certified, can_operate, status
      FROM organizations
      WHERE id = $1
    `,
      [ORG_ID],
    );

    if (orgCheck.rows.length === 0) {
      console.log(`❌ Organizzazione con ID ${ORG_ID} non trovata`);
      await client.end();
      process.exit(1);
    }

    const org = orgCheck.rows[0];
    console.log(
      `📋 Configurazione organizzazione: ${org.legal_name} (${ORG_ID})\n`,
    );

    // 1. Certifica l'organizzazione
    console.log("1️⃣  Certificazione organizzazione...");
    await client.query(
      `
      UPDATE organizations
      SET is_certified = true,
          can_operate = true,
          status = 'ACTIVE'
      WHERE id = $1
    `,
      [ORG_ID],
    );
    console.log("   ✅ Organizzazione certificata\n");

    // 2. Crea service configuration se non esiste
    console.log("2️⃣  Configurazione servizi...");
    const serviceConfigCheck = await client.query(
      `
      SELECT id FROM service_configurations WHERE org_id = $1
    `,
      [ORG_ID],
    );

    if (serviceConfigCheck.rows.length === 0) {
      await client.query(
        `
        INSERT INTO service_configurations (id, org_id, base_location_lat, base_location_lng, service_tags, created_at, updated_at)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
      `,
        [ORG_ID, BASE_LAT, BASE_LNG, JSON.stringify(SERVICE_TYPES)],
      );
      console.log(
        `   ✅ Service configuration creata (lat: ${BASE_LAT}, lng: ${BASE_LNG})\n`,
      );
    } else {
      await client.query(
        `
        UPDATE service_configurations
        SET base_location_lat = $1,
            base_location_lng = $2,
            service_tags = $3,
            updated_at = NOW()
        WHERE org_id = $4
      `,
        [BASE_LAT, BASE_LNG, JSON.stringify(SERVICE_TYPES), ORG_ID],
      );
      console.log(
        `   ✅ Service configuration aggiornata (lat: ${BASE_LAT}, lng: ${BASE_LNG})\n`,
      );
    }

    // 3. Crea rate cards per ogni servizio se non esistono
    console.log("3️⃣  Configurazione rate cards...");
    for (const serviceType of SERVICE_TYPES) {
      const rateCardCheck = await client.query(
        `
        SELECT id FROM rate_cards 
        WHERE seller_org_id = $1 AND service_type = $2
      `,
        [ORG_ID, serviceType],
      );

      if (rateCardCheck.rows.length === 0) {
        // Rate card di esempio
        await client.query(
          `
          INSERT INTO rate_cards (
            id, seller_org_id, service_type, 
            base_rate_per_ha_cents, min_charge_cents,
            travel_fixed_cents, travel_rate_per_km_cents,
            hilly_terrain_multiplier, hilly_terrain_surcharge_cents,
            is_active, created_at, updated_at
          )
          VALUES (
            gen_random_uuid()::text, $1, $2,
            5000,  -- 50€ per ettaro
            10000, -- 100€ minimo
            2000,  -- 20€ fisso trasporto
            50,    -- 0.50€ per km
            1.2,   -- +20% terreno collinare
            5000,  -- 50€ maggiorazione collinare
            true,
            NOW(),
            NOW()
          )
        `,
          [ORG_ID, serviceType],
        );
        console.log(`   ✅ Rate card creata per ${serviceType}`);
      } else {
        // Assicura che sia attiva
        await client.query(
          `
          UPDATE rate_cards
          SET is_active = true,
              updated_at = NOW()
          WHERE seller_org_id = $1 AND service_type = $2
        `,
          [ORG_ID, serviceType],
        );
        console.log(`   ✅ Rate card aggiornata per ${serviceType}`);
      }
    }

    console.log("");

    // Verifica finale
    console.log("4️⃣  Verifica configurazione...");
    const finalCheck = await client.query(
      `
      SELECT 
        o.legal_name,
        o.is_certified,
        o.can_operate,
        o.status,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        STRING_AGG(DISTINCT rc.service_type::text, ', ') as service_types,
        sc.base_location_lat,
        sc.base_location_lng
      FROM organizations o
      LEFT JOIN rate_cards rc ON rc.seller_org_id = o.id AND rc.is_active = true
      LEFT JOIN service_configurations sc ON sc.org_id = o.id
      WHERE o.id = $1
      GROUP BY o.legal_name, o.is_certified, o.can_operate, o.status, sc.base_location_lat, sc.base_location_lng
    `,
      [ORG_ID],
    );

    if (finalCheck.rows.length > 0) {
      const result = finalCheck.rows[0];
      console.log(`   ✅ Organizzazione: ${result.legal_name}`);
      console.log(`   ✅ Certificata: ${result.is_certified ? "Sì" : "No"}`);
      console.log(`   ✅ Può operare: ${result.can_operate ? "Sì" : "No"}`);
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   ✅ Rate Cards: ${result.rate_cards_count}`);
      console.log(`   ✅ Servizi: ${result.service_types || "Nessuno"}`);
      console.log(
        `   ✅ Base Location: ${result.base_location_lat || "N/A"}, ${result.base_location_lng || "N/A"}`,
      );
      console.log(
        "\n   🎉 Configurazione completata! L'organizzazione è pronta per i preventivi immediati.",
      );
    }

    await client.end();
  } catch (error) {
    console.error("❌ Errore durante la configurazione:", error);
    await client.end();
    process.exit(1);
  }
}

setupCertifiedOperator();
