#!/usr/bin/env node

import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient();

async function checkData() {
  try {
    const orgs = await prisma.organization.count();
    const users = await prisma.user.count();
    const memberships = await prisma.orgMembership.count();

    console.log('Database status:');
    console.log('- Organizations:', orgs);
    console.log('- Users:', users);
    console.log('- Memberships:', memberships);

    if (orgs === 0) {
      console.log('Creating test organization...');

      const org = await prisma.organization.create({
        data: {
          id: 'test-org',
          legal_name: 'Lenzi Agricola Srl',
          vat_number: 'IT12345678901',
          tax_code: 'LNZAGR80A01H501X',
          org_type: 'FARM',
          address_line: 'Via Roma 123',
          city: 'Milano',
          province: 'MI',
          region: 'Lombardia',
          country: 'IT'
        }
      });

      console.log('✅ Organization created:', org.legal_name);
    }

    if (users === 0) {
      console.log('Creating test user...');

      const user = await prisma.user.create({
        data: {
          id: 'test-user',
          email: 'admin@lenzi.it',
          first_name: 'Giacomo',
          last_name: 'Cavalcabo',
          password_hash: 'hashed_password',
          email_verified: true,
          status: 'ACTIVE'
        }
      });

      console.log('✅ User created:', user.email);
    }

    if (memberships === 0) {
      console.log('Creating test membership...');

      const membership = await prisma.orgMembership.create({
        data: {
          org_id: 'test-org',
          user_id: 'test-user',
          role: 'BUYER_ADMIN',
          is_active: true
        }
      });

      console.log('✅ Membership created with role:', membership.role);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
