import { PrismaClient } from "../../generated/prisma/index.js";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function seedTestUser() {
  try {
    console.log("🌱 Seeding test data for giacomocavalcabo13@gmail.com...");

    const testEmail = "giacomocavalcabo13@gmail.com";

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (existingUser) {
      console.log("✅ User already exists, skipping seeding");
      return;
    }

    // Create test user
    const password = process.env.SEED_TEST_PASSWORD || "password123";
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        first_name: "Giacomo",
        last_name: "Cavalcabo",
        phone: "+39 333 123 4567",
        password_hash: hashedPassword,
        email_verified: true,
        status: "ACTIVE",
      },
    });

    console.log("✅ Created user:", user.email);

    // Create buyer organization
    const organization = await prisma.organization.create({
      data: {
        legal_name: "Azienda Agricola Cavalcabo",
        address_line: "Via dei Vigneti, 15",
        city: "Montalcino",
        province: "SI",
        region: "Toscana",
        postal_code: "53024",
        country: "IT",
        kind: "BUSINESS",
        type: "buyer", // NUOVA LOGICA: tipo invece di capabilities
        status: "ACTIVE",
      },
    });

    console.log("✅ Created organization:", organization.legal_name);

    // Create membership
    await prisma.orgMembership.create({
      data: {
        org_id: organization.id,
        user_id: user.id,
        role: "BUYER",
        is_active: true,
      },
    });

    // Create payment account
    await prisma.orgPaymentAccount.create({
      data: {
        org_id: organization.id,
        provider: "stripe",
        onboarding_status: "PENDING",
      },
    });

    // Create operator organization
    const operatorOrg = await prisma.organization.create({
      data: {
        legal_name: "DroneAgri Toscana Srl",
        address_line: "Via Industriale, 25",
        city: "Siena",
        province: "SI",
        region: "Toscana",
        postal_code: "53100",
        country: "IT",
        kind: "BUSINESS",
        type: "operator", // NUOVA LOGICA: tipo invece di capabilities
        status: "ACTIVE",
      },
    });

    console.log("✅ Created operator organization:", operatorOrg.legal_name);

    // Create operator user
    const operatorUser = await prisma.user.create({
      data: {
        email: "operator@droneagri.it",
        first_name: "Marco",
        last_name: "Rossi",
        phone: "+39 333 987 6543",
        password_hash: await hashPassword(
          process.env.SEED_TEST_PASSWORD || "password123",
        ),
        email_verified: true,
        status: "ACTIVE",
      },
    });

    // Create operator membership
    await prisma.orgMembership.create({
      data: {
        org_id: operatorOrg.id,
        user_id: operatorUser.id,
        role: "OPERATOR",
        is_active: true,
      },
    });

    // Create sample jobs
    const jobs = [
      {
        field_name: "Vigneto Chianti Classico",
        area_ha: 25.5,
        service_type: "SPRAY",
        status: "OPEN",
        field_polygon:
          '{"type":"Polygon","coordinates":[[[11.2,43.1],[11.3,43.1],[11.3,43.2],[11.2,43.2],[11.2,43.1]]]}',
        location_json:
          '{"centroid":[11.25,43.15],"address":"Chianti, Toscana","comune":"Gaiole in Chianti"}',
        requested_window_start: new Date("2025-01-15"),
        requested_window_end: new Date("2025-01-20"),
        constraints_json:
          '{"crop_type":"vigneto","urgency":"normal","obstacles":"nessuno"}',
      },
      {
        field_name: "Oliveto Crete Senesi",
        area_ha: 45.2,
        service_type: "SPRAY",
        status: "OPEN",
        field_polygon:
          '{"type":"Polygon","coordinates":[[[11.5,43.3],[11.6,43.3],[11.6,43.4],[11.5,43.4],[11.5,43.3]]]}',
        location_json:
          '{"centroid":[11.55,43.35],"address":"Crete Senesi, Toscana","comune":"Asciano"}',
        requested_window_start: new Date("2025-01-10"),
        requested_window_end: new Date("2025-01-12"),
        constraints_json:
          '{"crop_type":"oliveto","urgency":"high","obstacles":"strade interne"}',
      },
      {
        field_name: "Campo Mais Val d'Orcia",
        area_ha: 120.8,
        service_type: "MAPPING",
        status: "OPEN",
        field_polygon:
          '{"type":"Polygon","coordinates":[[[11.4,43.0],[11.7,43.0],[11.7,43.3],[11.4,43.3],[11.4,43.0]]]}',
        location_json:
          '{"centroid":[11.55,43.15],"address":"Val d\'Orcia, Toscana","comune":"Pienza"}',
        requested_window_start: new Date("2025-01-08"),
        requested_window_end: new Date("2025-01-10"),
        constraints_json:
          '{"crop_type":"mais","urgency":"normal","obstacles":"fossi"}',
      },
    ];

    for (const jobData of jobs) {
      const job = await prisma.job.create({
        data: {
          buyer_org_id: organization.id,
          ...jobData,
        },
      });

      console.log(`✅ Created job: ${job.field_name} (${job.area_ha} ha)`);

      // Create job offer from operator
      const pricingSnapshot = {
        input: {
          seller_org_id: operatorOrg.id,
          service_type: job.service_type,
          area_ha: job.area_ha,
          distance_km: 25,
          risk_key: "medium",
          month: new Date().getMonth() + 1,
        },
        calculation: {
          baseRatePerHa: job.service_type === "SPRAY" ? 35 : 75,
          total: Math.round(
            (job.service_type === "SPRAY" ? 35 : 75) * job.area_ha * 100,
          ),
        },
      };

      await prisma.jobOffer.create({
        data: {
          job_id: job.id,
          operator_org_id: operatorOrg.id,
          status: "OFFERED",
          pricing_snapshot_json: JSON.stringify(pricingSnapshot),
          total_cents: pricingSnapshot.calculation.total,
          currency: "EUR",
          proposed_start: job.requested_window_start,
          proposed_end: job.requested_window_end,
          provider_note: `Offerta per ${job.field_name}. Servizio professionale con droni DJI Agras.`,
        },
      });

      console.log(`✅ Created job offer for ${job.field_name}`);
    }

    // Create sample conversation for first job
    const firstJob = await prisma.job.findFirst({
      where: { buyer_org_id: organization.id },
    });

    if (firstJob) {
      const conversation = await prisma.conversation.create({
        data: {
          context_type: "JOB",
          context_id: firstJob.id,
          status: "OPEN",
        },
      });

      // Add participants
      await prisma.conversationParticipant.create({
        data: {
          conversation_id: conversation.id,
          org_id: organization.id,
          role: "BUYER",
        },
      });

      await prisma.conversationParticipant.create({
        data: {
          conversation_id: conversation.id,
          org_id: operatorOrg.id,
          role: "OPERATOR",
        },
      });

      // Add sample messages
      await prisma.message.create({
        data: {
          conversation_id: conversation.id,
          sender_user_id: operatorUser.id,
          body: "Salve! Ho visto la sua richiesta per il trattamento del vigneto. Posso eseguire il servizio con droni DJI Agras T40 entro la settimana prossima. Le condizioni sembrano ottimali per un trattamento efficace.",
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
      });

      await prisma.message.create({
        data: {
          conversation_id: conversation.id,
          sender_user_id: user.id,
          body: "Perfetto! Mi interessa la sua offerta. Può dirmi di più sui tempi di esecuzione e sulle condizioni meteorologiche ottimali?",
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
      });

      console.log("✅ Created conversation with sample messages");
    }

    console.log("🎉 Test data seeding completed successfully!");
    console.log("📧 User created: giacomocavalcabo13@gmail.com");
    const testPassword = process.env.SEED_TEST_PASSWORD || "password123";
    console.log(
      `🔑 Password: ${testPassword} (configura SEED_TEST_PASSWORD per cambiarla)`,
    );
    console.log("🏢 Organization: Azienda Agricola Cavalcabo");
    console.log("📋 Jobs created: 3 (with offers from DroneAgri Toscana)");
    console.log("💬 Conversation: 1 (with sample messages)");
  } catch (error) {
    console.error("❌ Error seeding test data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedTestUser();
