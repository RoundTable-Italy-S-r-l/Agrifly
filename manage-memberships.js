#!/usr/bin/env node

import { PrismaClient } from './generated/prisma/client.js';
import readline from 'readline';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function listUsers() {
  console.log('\n👥 UTENTI REGISTRATI:');
  console.log('─'.repeat(80));

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      status: true,
      _count: {
        select: {
          org_memberships: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  if (users.length === 0) {
    console.log('❌ Nessun utente trovato');
    return [];
  }

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   Nome: ${user.first_name} ${user.last_name}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Organizzazioni: ${user._count.org_memberships}`);
    console.log(`   ID: ${user.id}`);
    console.log('');
  });

  return users;
}

async function listOrganizations() {
  console.log('\n🏢 ORGANIZZAZIONI:');
  console.log('─'.repeat(80));

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      legal_name: true,
      org_type: true,
      status: true,
      _count: {
        select: {
          members: true
        }
      }
    },
    orderBy: { legal_name: 'asc' }
  });

  if (orgs.length === 0) {
    console.log('❌ Nessuna organizzazione trovata');
    return [];
  }

  orgs.forEach((org, index) => {
    console.log(`${index + 1}. ${org.legal_name}`);
    console.log(`   Tipo: ${org.org_type}`);
    console.log(`   Status: ${org.status}`);
    console.log(`   Membri: ${org._count.members}`);
    console.log(`   ID: ${org.id}`);
    console.log('');
  });

  return orgs;
}

async function listMemberships() {
  console.log('\n🔗 MEMBERSHIP ATTIVE:');
  console.log('─'.repeat(80));

  const memberships = await prisma.orgMembership.findMany({
    where: { is_active: true },
    include: {
      user: {
        select: { email: true, first_name: true, last_name: true }
      },
      org: {
        select: { legal_name: true, org_type: true }
      }
    },
    orderBy: [
      { org: { legal_name: 'asc' } },
      { user: { email: 'asc' } }
    ]
  });

  if (memberships.length === 0) {
    console.log('❌ Nessuna membership attiva');
    return;
  }

  memberships.forEach((membership, index) => {
    console.log(`${index + 1}. ${membership.user.email} → ${membership.org.legal_name}`);
    console.log(`   Ruolo: ${membership.role}`);
    console.log(`   Organizzazione: ${membership.org.org_type}`);
    console.log(`   Data creazione: ${membership.created_at.toLocaleDateString('it-IT')}`);
    console.log('');
  });
}

async function createMembership() {
  console.log('\n➕ CREA NUOVA MEMBERSHIP');
  console.log('─'.repeat(50));

  // Lista utenti
  const users = await listUsers();
  if (users.length === 0) {
    console.log('❌ Nessun utente disponibile');
    return;
  }

  // Lista organizzazioni
  const orgs = await listOrganizations();
  if (orgs.length === 0) {
    console.log('❌ Nessuna organizzazione disponibile');
    return;
  }

  // Chiedi selezione utente
  const userIndex = await ask('Seleziona utente (numero): ');
  const userNum = parseInt(userIndex) - 1;

  if (userNum < 0 || userNum >= users.length) {
    console.log('❌ Selezione utente non valida');
    return;
  }

  const selectedUser = users[userNum];

  // Chiedi selezione organizzazione
  const orgIndex = await ask('Seleziona organizzazione (numero): ');
  const orgNum = parseInt(orgIndex) - 1;

  if (orgNum < 0 || orgNum >= orgs.length) {
    console.log('❌ Selezione organizzazione non valida');
    return;
  }

  const selectedOrg = orgs[orgNum];

  // Verifica se membership già esiste
  const existingMembership = await prisma.orgMembership.findUnique({
    where: {
      org_id_user_id: {
        org_id: selectedOrg.id,
        user_id: selectedUser.id
      }
    }
  });

  if (existingMembership) {
    console.log(`⚠️  Membership già esistente!`);
    console.log(`   Utente: ${selectedUser.email}`);
    console.log(`   Organizzazione: ${selectedOrg.legal_name}`);
    console.log(`   Ruolo attuale: ${existingMembership.role}`);
    console.log(`   Attiva: ${existingMembership.is_active}`);

    const update = await ask('Vuoi aggiornare il ruolo? (s/n): ');
    if (update.toLowerCase() !== 's') {
      return;
    }
  }

  // Mostra ruoli disponibili
  console.log('\n🎭 RUOLI DISPONIBILI:');
  console.log('1. BUYER_ADMIN    - Amministratore acquirente');
  console.log('2. VENDOR_ADMIN   - Amministratore venditore');
  console.log('3. DISPATCHER     - Dispatcher');
  console.log('4. PILOT          - Pilota drone');
  console.log('5. SALES          - Addetto vendite');

  const roleChoice = await ask('Seleziona ruolo (numero): ');
  const roles = ['BUYER_ADMIN', 'VENDOR_ADMIN', 'DISPATCHER', 'PILOT', 'SALES'];
  const roleIndex = parseInt(roleChoice) - 1;

  if (roleIndex < 0 || roleIndex >= roles.length) {
    console.log('❌ Selezione ruolo non valida');
    return;
  }

  const selectedRole = roles[roleIndex];

  try {
    // Crea o aggiorna membership
    const membership = await prisma.orgMembership.upsert({
      where: {
        org_id_user_id: {
          org_id: selectedOrg.id,
          user_id: selectedUser.id
        }
      },
      update: {
        role: selectedRole,
        is_active: true
      },
      create: {
        org_id: selectedOrg.id,
        user_id: selectedUser.id,
        role: selectedRole,
        is_active: true
      }
    });

    console.log('\n✅ MEMBERSHIP CREATA/AGGIORNATA!');
    console.log(`👤 Utente: ${selectedUser.email}`);
    console.log(`🏢 Organizzazione: ${selectedOrg.legal_name}`);
    console.log(`🎭 Ruolo: ${selectedRole}`);
    console.log(`📅 Data: ${membership.created_at.toLocaleString('it-IT')}`);

  } catch (error) {
    console.error('❌ Errore nella creazione della membership:', error.message);
  }
}

async function removeMembership() {
  console.log('\n➖ RIMUOVI MEMBERSHIP');
  console.log('─'.repeat(50));

  // Lista membership attive
  const memberships = await prisma.orgMembership.findMany({
    where: { is_active: true },
    include: {
      user: { select: { email: true, first_name: true, last_name: true } },
      org: { select: { legal_name: true, org_type: true } }
    },
    orderBy: [
      { org: { legal_name: 'asc' } },
      { user: { email: 'asc' } }
    ]
  });

  if (memberships.length === 0) {
    console.log('❌ Nessuna membership attiva da rimuovere');
    return;
  }

  console.log('MEMBERSHIP ATTIVE:');
  memberships.forEach((membership, index) => {
    console.log(`${index + 1}. ${membership.user.email} → ${membership.org.legal_name} (${membership.role})`);
  });

  const choice = await ask('Seleziona membership da rimuovere (numero): ');
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= memberships.length) {
    console.log('❌ Selezione non valida');
    return;
  }

  const selectedMembership = memberships[index];

  const confirm = await ask(`Confermi rimozione di ${selectedMembership.user.email} da ${selectedMembership.org.legal_name}? (s/n): `);

  if (confirm.toLowerCase() === 's') {
    await prisma.orgMembership.update({
      where: { id: selectedMembership.id },
      data: { is_active: false }
    });

    console.log('✅ Membership disattivata con successo!');
  } else {
    console.log('❌ Operazione annullata');
  }
}

async function main() {
  console.log('🚀 GESTIONE MEMBERSHIP UTENTE-ORGANIZZAZIONE');
  console.log('═'.repeat(60));

  while (true) {
    console.log('\n📋 MENU:');
    console.log('1. 📋 Lista utenti');
    console.log('2. 🏢 Lista organizzazioni');
    console.log('3. 🔗 Lista membership');
    console.log('4. ➕ Crea membership');
    console.log('5. ➖ Rimuovi membership');
    console.log('0. 🚪 Esci');

    const choice = await ask('\nScegli opzione: ');

    try {
      switch (choice) {
        case '1':
          await listUsers();
          break;
        case '2':
          await listOrganizations();
          break;
        case '3':
          await listMemberships();
          break;
        case '4':
          await createMembership();
          break;
        case '5':
          await removeMembership();
          break;
        case '0':
          console.log('👋 Arrivederci!');
          rl.close();
          await prisma.$disconnect();
          process.exit(0);
        default:
          console.log('❌ Opzione non valida');
      }
    } catch (error) {
      console.error('❌ Errore:', error.message);
    }

    await ask('\nPremi INVIO per continuare...');
  }
}

// Gestione errori e chiusura
process.on('SIGINT', async () => {
  console.log('\n👋 Chiusura...');
  rl.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Avvia programma
main().catch(async (error) => {
  console.error('❌ Errore fatale:', error);
  rl.close();
  await prisma.$disconnect();
  process.exit(1);
});
