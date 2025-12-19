import { PrismaClient } from '../../generated/prisma/client';
import { hashPassword } from '../utils/auth';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const email = 'giacomo.cavalcabo14@gmail.com';
  const password = 'Palemone01!';
  const firstName = 'Giacomo';
  const lastName = 'Cavalcabo';

  console.log('🔐 Creando utente admin...');

  // Hash password
  const password_hash = hashPassword(password);

  // Cerca o crea organization Lenzi
  let lenziOrg = await prisma.organization.findFirst({
    where: {
      legal_name: { contains: 'Lenzi', mode: 'insensitive' }
    }
  });

  if (!lenziOrg) {
    console.log('📦 Creando organization Lenzi...');
    lenziOrg = await prisma.organization.create({
      data: {
        legal_name: 'Lenzi',
        org_type: 'VENDOR',
        address_line: '',
        city: '',
        province: '',
        region: '',
        country: 'IT',
        status: 'ACTIVE',
      },
    });
    console.log('✅ Organization Lenzi creata:', lenziOrg.id);
  } else {
    console.log('✅ Organization Lenzi trovata:', lenziOrg.id);
  }

  // Crea o aggiorna utente
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password_hash,
      first_name: firstName,
      last_name: lastName,
      email_verified: true,
      email_verified_at: new Date(),
      status: 'ACTIVE',
    },
    create: {
      email,
      password_hash,
      first_name: firstName,
      last_name: lastName,
      email_verified: true,
      email_verified_at: new Date(),
      status: 'ACTIVE',
    },
  });

  console.log('✅ Utente creato/aggiornato:', user.id);

  // Crea o aggiorna membership come VENDOR_ADMIN
  const membership = await prisma.orgMembership.upsert({
    where: {
      org_id_user_id: {
        org_id: lenziOrg.id,
        user_id: user.id,
      },
    },
    update: {
      role: 'VENDOR_ADMIN',
      is_active: true,
    },
    create: {
      org_id: lenziOrg.id,
      user_id: user.id,
      role: 'VENDOR_ADMIN',
      is_active: true,
    },
  });

  console.log('✅ Membership creata/aggiornata:', membership.id);
  console.log('');
  console.log('🎉 Account creato con successo!');
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  console.log('👤 Ruolo: VENDOR_ADMIN');
  console.log('🏢 Organization: Lenzi');
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

