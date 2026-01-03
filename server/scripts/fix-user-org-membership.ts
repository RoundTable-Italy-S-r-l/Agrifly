import "dotenv/config";
import { prisma } from "../utils/prisma.js";

async function fixUserOrgMembership() {
  try {
    const email = "giacomo.cavalcabo14@gmail.com";

    // Trova l'utente
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        org_memberships: {
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      console.log("❌ Utente non trovato:", email);
      return;
    }

    console.log("✅ Utente trovato:");
    console.log("  ID:", user.id);
    console.log("  Email:", user.email);
    console.log("  Nome:", user.first_name, user.last_name);
    console.log("\n📋 Organizzazioni associate:");

    if (user.org_memberships.length === 0) {
      console.log("  ⚠️  Nessuna organizzazione associata!");
    } else {
      user.org_memberships.forEach((m) => {
        console.log(
          `  - ${m.org.legal_name} (${m.org.id}) - Ruolo: ${m.role} - Attivo: ${m.is_active}`,
        );
      });
    }

    // Verifica se Lenzi esiste
    const lenzi = await prisma.organization.findUnique({
      where: { id: "lenzi-org-id" },
    });

    if (!lenzi) {
      console.log("\n❌ Organizzazione Lenzi non trovata!");
      return;
    }

    console.log("\n✅ Organizzazione Lenzi trovata:");
    console.log("  ID:", lenzi.id);
    console.log("  Nome:", lenzi.legal_name);
    console.log("  Status:", lenzi.status);

    // Verifica se l'utente è membro di Lenzi
    const lenziMembership = user.org_memberships.find(
      (m) => m.org_id === "lenzi-org-id",
    );

    if (!lenziMembership) {
      console.log("\n⚠️  L'utente NON è membro di Lenzi!");
      console.log("\n🔧 Creo il membership...");

      const newMembership = await prisma.orgMembership.create({
        data: {
          org_id: "lenzi-org-id",
          user_id: user.id,
          role: "VENDOR_ADMIN",
          is_active: true,
        },
      });

      console.log("✅ Membership creato:", newMembership.id);
      console.log("  Ruolo: VENDOR_ADMIN");
      console.log("  Attivo: true");
    } else {
      console.log("\n✅ L'utente è già membro di Lenzi");
      console.log("  Ruolo:", lenziMembership.role);
      console.log("  Attivo:", lenziMembership.is_active);

      // Se non è attivo, attivalo
      if (!lenziMembership.is_active) {
        console.log("\n🔧 Attivo il membership...");
        await prisma.orgMembership.update({
          where: { id: lenziMembership.id },
          data: { is_active: true },
        });
        console.log("✅ Membership attivato");
      }
    }
  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserOrgMembership();
