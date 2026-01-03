import { PrismaClient } from "./generated/prisma/index.js";
const prisma = new PrismaClient();

async function verifySystem() {
  console.log("🔍 VERIFICA SISTEMA COMPLETA\n");

  try {
    // 1. Verifica schema database
    console.log("1️⃣ DATABASE SCHEMA:");
    const serviceConfigs = await prisma.serviceConfiguration.findMany({
      take: 1,
    });
    if (serviceConfigs.length > 0) {
      const config = serviceConfigs[0];
      console.log(
        "   ✅ ServiceConfiguration fields:",
        Object.keys(config).filter(
          (k) =>
            k.includes("job_filter") ||
            k.includes("operating") ||
            k.includes("offered") ||
            k.includes("hourly") ||
            k.includes("manageable") ||
            k.includes("work_"),
        ),
      );
    }

    // 2. Verifica job offers
    console.log("\n2️⃣ JOB OFFERS:");
    const offers = await prisma.jobOffer.findMany({
      include: { job: true, operator_org: true },
    });
    console.log("   📊 Total offers:", offers.length);
    const statusCount = offers.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    console.log("   📈 Status distribution:", statusCount);

    // 3. Verifica jobs
    console.log("\n3️⃣ JOBS:");
    const jobs = await prisma.job.findMany({ include: { buyer_org: true } });
    console.log("   📊 Total jobs:", jobs.length);
    const jobStatusCount = jobs.reduce((acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    }, {});
    console.log("   📈 Status distribution:", jobStatusCount);

    // 4. Verifica conversations
    console.log("\n4️⃣ CONVERSATIONS:");
    const conversations = await prisma.conversation.findMany({
      include: {
        participants: true,
        messages: true,
      },
    });
    console.log("   📊 Total conversations:", conversations.length);
    console.log(
      "   🔓 Unlocked conversations:",
      conversations.filter((c) => c.status === "OPEN").length,
    );

    // 5. Verifica operators esistenti
    console.log("\n5️⃣ OPERATORS:");
    const operators = await prisma.organization.findMany({
      where: { can_operate: true },
      include: { service_configuration: true },
    });
    console.log("   👥 Organizations that can operate:", operators.length);
    operators.forEach((op) => {
      console.log(
        `   - ${op.legal_name}: filters enabled = ${op.service_configuration?.[0]?.enable_job_filters || false}`,
      );
    });

    // 6. Test filtri matching logic
    console.log("\n6️⃣ FILTER MATCHING TEST:");
    if (jobs.length > 0 && operators.length > 0) {
      const testJob = jobs[0];
      const testOperator = operators[0];

      console.log(
        `   🧪 Testing job "${testJob.field_name}" with operator "${testOperator.legal_name}"`,
      );

      const config = testOperator.service_configuration?.[0];
      if (config) {
        console.log(
          `   ⚙️ Operator filters enabled: ${config.enable_job_filters}`,
        );
        console.log(`   📅 Available days: ${config.available_days}`);
        console.log(
          `   🕐 Work hours: ${config.work_start_hour} - ${config.work_end_hour}`,
        );

        // Simula matching
        let matches = true;
        if (config.offered_service_types) {
          const offered = JSON.parse(config.offered_service_types);
          if (!offered.includes(testJob.service_type)) {
            matches = false;
            console.log(
              `   ❌ Service type mismatch: ${testJob.service_type} not in ${offered}`,
            );
          }
        }

        if (matches) {
          console.log("   ✅ Would match (basic check)");
        }
      }
    }

    console.log("\n🎉 VERIFICA COMPLETATA!");
  } catch (error) {
    console.error("❌ Errore verifica:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySystem();
