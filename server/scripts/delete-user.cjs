const { PrismaClient } = require("../../generated/prisma/index.js");

async function deleteUser() {
  const prisma = new PrismaClient();

  try {
    console.log("🔍 Cercando utente cavalcabogiacomo@gmail.com...");

    const user = await prisma.user.findUnique({
      where: { email: "cavalcabogiacomo@gmail.com" },
      include: {
        org_memberships: {
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      console.log("✅ Utente già eliminato");
      return;
    }

    console.log(`🗑️ Eliminando utente: ${user.email}`);

    // Elimina tutto in una transaction
    await prisma.$transaction(async (tx) => {
      // Prima elimina tutto quello che dipende dall'utente
      await tx.verificationCode.deleteMany({
        where: { user_id: user.id },
      });

      await tx.organizationInvitation.deleteMany({
        where: { invited_by_user_id: user.id },
      });

      await tx.message.deleteMany({
        where: { sender_user_id: user.id },
      });

      await tx.operatorProfile.deleteMany({
        where: { user_id: user.id },
      });

      // Gestisci ogni membership
      for (const membership of user.org_memberships) {
        console.log(
          `🗑️ Eliminando membership per ${membership.org.legal_name}`,
        );

        // Elimina il membership
        await tx.orgMembership.delete({
          where: { id: membership.id },
        });

        // Controlla se l'organizzazione è vuota
        const remainingMembers = await tx.orgMembership.count({
          where: { org_id: membership.org_id },
        });

        if (remainingMembers === 0) {
          console.log(
            `🗑️ Eliminando organizzazione vuota: ${membership.org.legal_name}`,
          );

          // Elimina tutto quello che dipende dall'organizzazione
          await tx.orgPaymentAccount.deleteMany({
            where: { org_id: membership.org_id },
          });

          await tx.job.deleteMany({
            where: {
              OR: [
                { buyer_org_id: membership.org_id },
                { broker_org_id: membership.org_id },
              ],
            },
          });

          await tx.jobOffer.deleteMany({
            where: { operator_org_id: membership.org_id },
          });

          await tx.booking.deleteMany({
            where: {
              OR: [
                { buyer_org_id: membership.org_id },
                { broker_org_id: membership.org_id },
                { executor_org_id: membership.org_id },
              ],
            },
          });

          await tx.conversationParticipant.deleteMany({
            where: { org_id: membership.org_id },
          });

          await tx.wishlistItem.deleteMany({
            where: { org_id: membership.org_id },
          });

          // Infine elimina l'organizzazione
          await tx.organization.delete({
            where: { id: membership.org_id },
          });
        }
      }

      // Infine elimina l'utente
      await tx.user.delete({
        where: { id: user.id },
      });
    });

    console.log("✅ Utente eliminato con successo!");
  } catch (error) {
    console.error("❌ Errore durante l'eliminazione:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();
