import { PrismaClient } from '../../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function seedVendorOperator() {
  try {
    console.log('🌱 Seeding vendor-operator data...');

    const vendorEmail = 'vendor@dronepro.it';

    // Check if vendor user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: vendorEmail }
    });

    let user;
    if (existingUser) {
      user = existingUser;
      console.log('✅ Using existing vendor user:', user.email);
    } else {
      // Create vendor user
      const password = process.env.SEED_VENDOR_PASSWORD || 'vendor123';
      const hashedPassword = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: vendorEmail,
          first_name: 'Luca',
          last_name: 'Bianchi',
          phone: '+39 333 555 7777',
          password_hash: hashedPassword,
          email_verified: true,
          status: 'ACTIVE'
        }
      });
      console.log('✅ Created vendor user:', user.email);
    }

    // Create or get vendor-operator organization
    let organization = await prisma.organization.findFirst({
      where: { legal_name: 'DronePro Italia Srl' }
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          legal_name: 'DronePro Italia Srl',
          address_line: 'Via dell\'Innovazione, 25',
          city: 'Bologna',
          province: 'BO',
          region: 'Emilia-Romagna',
          postal_code: '40100',
          country: 'IT',
          phone: '+39 051 123 4567',
          support_email: 'support@dronepro.it',
          vat_number: 'IT12345678901',
          kind: 'BUSINESS',
          can_buy: false,      // Non è un compratore
          can_sell: true,      // È un venditore
          can_operate: true,   // È anche un operatore
          can_dispatch: false, // Non è un dispatcher
          status: 'ACTIVE'
        }
      });
      console.log('✅ Created vendor-operator organization:', organization.legal_name);
    } else {
      console.log('✅ Using existing vendor-operator organization:', organization.legal_name);
    }

    // Create organization membership (only if doesn't exist)
    const existingMembership = await prisma.orgMembership.findFirst({
      where: {
        org_id: organization.id,
        user_id: user.id
      }
    });

    if (existingMembership) {
      console.log('✅ Membership already exists with role:', existingMembership.role);
    } else {
      const membership = await prisma.orgMembership.create({
        data: {
          org_id: organization.id,
          user_id: user.id,
          role: 'ADMIN',
          is_active: true
        }
      });
      console.log('✅ Created membership with role:', membership.role);
    }

    // Create payment account (only if doesn't exist)
    const existingPaymentAccount = await prisma.orgPaymentAccount.findUnique({
      where: { org_id: organization.id }
    });

    if (existingPaymentAccount) {
      console.log('✅ Payment account already exists');
    } else {
      const paymentAccount = await prisma.orgPaymentAccount.create({
        data: {
          org_id: organization.id,
          provider: 'stripe',
          onboarding_status: 'PENDING'
        }
      });
      console.log('✅ Created payment account');
    }

    // Create some operators for this vendor organization
    const operators = [
      {
        name: 'Giovanni Verdi',
        email: 'giovanni@dronepro.it',
        phone: '+39 333 111 2222'
      },
      {
        name: 'Sara Rossi',
        email: 'sara@dronepro.it',
        phone: '+39 333 333 4444'
      }
    ];

    for (const op of operators) {
      let operatorUser = await prisma.user.findUnique({
        where: { email: op.email }
      });

      if (!operatorUser) {
        operatorUser = await prisma.user.create({
          data: {
            email: op.email,
            first_name: op.name.split(' ')[0],
            last_name: op.name.split(' ')[1],
            phone: op.phone,
            password_hash: await hashPassword(process.env.SEED_OPERATOR_PASSWORD || 'operator123'),
            email_verified: true,
            status: 'ACTIVE'
          }
        });
        console.log(`✅ Created operator: ${op.name}`);
      } else {
        console.log(`✅ Operator already exists: ${op.name}`);
      }

      // Add operator to the vendor organization (only if membership doesn't exist)
      const existingOperatorMembership = await prisma.orgMembership.findFirst({
        where: {
          org_id: organization.id,
          user_id: operatorUser.id
        }
      });

      if (!existingOperatorMembership) {
        await prisma.orgMembership.create({
          data: {
            org_id: organization.id,
            user_id: operatorUser.id,
            role: 'OPERATOR',
            is_active: true
          }
        });
        console.log(`✅ Added ${op.name} to vendor organization as operator`);
      } else {
        console.log(`✅ ${op.name} already in vendor organization`);
      }
    }

    console.log('🎉 Vendor-operator seeding completed!');
    console.log('');
    console.log('📧 Vendor Admin Credentials:');
    console.log('   Email: vendor@dronepro.it');
    console.log(`   Password: ${process.env.SEED_VENDOR_PASSWORD || 'vendor123'} (configura SEED_VENDOR_PASSWORD per cambiarla)`);
    console.log('');
    console.log('👥 Operator Credentials:');
    const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || 'operator123';
    console.log(`   giovanni@dronepro.it / ${operatorPassword}`);
    console.log(`   sara@dronepro.it / ${operatorPassword}`);
    console.log(`   (configura SEED_OPERATOR_PASSWORD per cambiarla)`);

  } catch (error) {
    console.error('❌ Error seeding vendor-operator:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedVendorOperator();
