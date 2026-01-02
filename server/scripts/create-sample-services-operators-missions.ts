import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Usa direct connection invece del pooler per evitare problemi con prepared statements
const getDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  // Se usa connection pooler (porta 6543), usa direct connection (porta 5432)
  if (dbUrl.includes(':6543/')) {
    return dbUrl.replace(':6543/', ':5432/');
  }
  return dbUrl;
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});

async function main() {
  console.log('🔄 Creazione dati fittizi: servizi, operatori e missioni...');

  // 1. Trova organizzazione Lenzi
  const lenziOrg = await prisma.organization.findUnique({
    where: { id: 'lenzi-org-id' }
  });

  if (!lenziOrg) {
    console.error('❌ Organizzazione Lenzi non trovata!');
    process.exit(1);
  }

  // 2. Trova location principale
  const location = await prisma.location.findFirst({
    where: { org_id: lenziOrg.id }
  });

  if (!location) {
    console.error('❌ Location non trovata!');
    process.exit(1);
  }

  // 3. Crea Rate Cards (Servizi)
  console.log('📋 Creazione Rate Cards...');
  const rateCards = [
    {
      service_type: 'SPRAY' as const,
      base_rate_per_ha_cents: 1800, // €18/ha
      min_charge_cents: 25000, // €250 minimo
      travel_rate_per_km_cents: 120, // €1.20/km
      hourly_operator_rate_cents: 3500, // €35/ora
      seasonal_multipliers_json: {
        spring: 1.0,
        summer: 1.2,
        autumn: 1.0,
        winter: 0.8
      },
      risk_multipliers_json: {
        low: 1.0,
        medium: 1.15,
        high: 1.3
      }
    },
    {
      service_type: 'SPREAD' as const,
      base_rate_per_ha_cents: 1500, // €15/ha
      min_charge_cents: 20000, // €200 minimo
      travel_rate_per_km_cents: 100, // €1/km
      hourly_operator_rate_cents: 3000, // €30/ora
      seasonal_multipliers_json: {
        spring: 1.1,
        summer: 0.9,
        autumn: 1.2,
        winter: 0.7
      },
      risk_multipliers_json: {
        low: 1.0,
        medium: 1.1,
        high: 1.25
      }
    },
    {
      service_type: 'MAPPING' as const,
      base_rate_per_ha_cents: 800, // €8/ha
      min_charge_cents: 15000, // €150 minimo
      travel_rate_per_km_cents: 80, // €0.80/km
      hourly_operator_rate_cents: 4000, // €40/ora
      seasonal_multipliers_json: {
        spring: 1.0,
        summer: 1.0,
        autumn: 1.0,
        winter: 1.0
      },
      risk_multipliers_json: {
        low: 1.0,
        medium: 1.05,
        high: 1.1
      }
    }
  ];

  for (const rateCard of rateCards) {
    await prisma.rateCard.upsert({
      where: {
        seller_org_id_service_type: {
          seller_org_id: lenziOrg.id,
          service_type: rateCard.service_type
        }
      },
      update: rateCard,
      create: {
        seller_org_id: lenziOrg.id,
        ...rateCard
      }
    });
  }
  console.log(`✅ Create ${rateCards.length} rate cards`);

  // 4. Crea Users (Operatori)
  console.log('👤 Creazione operatori...');
  const operators = [
    {
      email: 'mario.rossi@lenzi.it',
      first_name: 'Mario',
      last_name: 'Rossi',
      password_hash: '$2b$10$dummy.hash.for.testing.purposes.only',
      status: 'ACTIVE' as const,
      email_verified: true,
      operatorProfile: {
        max_hours_per_day: 8.0,
        max_ha_per_day: 50.0,
        service_tags: ['SPRAY', 'SPREAD'],
        status: 'ACTIVE' as const
      }
    },
    {
      email: 'luca.bianchi@lenzi.it',
      first_name: 'Luca',
      last_name: 'Bianchi',
      password_hash: '$2b$10$dummy.hash.for.testing.purposes.only',
      status: 'ACTIVE' as const,
      email_verified: true,
      operatorProfile: {
        max_hours_per_day: 6.0,
        max_ha_per_day: 40.0,
        service_tags: ['MAPPING', 'SPRAY'],
        status: 'ACTIVE' as const
      }
    },
    {
      email: 'giovanni.verdi@lenzi.it',
      first_name: 'Giovanni',
      last_name: 'Verdi',
      password_hash: '$2b$10$dummy.hash.for.testing.purposes.only',
      status: 'ACTIVE' as const,
      email_verified: true,
      operatorProfile: {
        max_hours_per_day: 7.0,
        max_ha_per_day: 45.0,
        service_tags: ['SPREAD', 'MAPPING'],
        status: 'ACTIVE' as const
      }
    }
  ];

  const createdOperators = [];
  for (const op of operators) {
    const user = await prisma.user.upsert({
      where: { email: op.email },
      update: {
        first_name: op.first_name,
        last_name: op.last_name,
        status: op.status
      },
      create: {
        email: op.email,
        first_name: op.first_name,
        last_name: op.last_name,
        password_hash: op.password_hash,
        status: op.status,
        email_verified: op.email_verified
      }
    });

    // Crea membership
    await prisma.orgMembership.upsert({
      where: {
        org_id_user_id: {
          org_id: lenziOrg.id,
          user_id: user.id
        }
      },
      update: {},
      create: {
        org_id: lenziOrg.id,
        user_id: user.id,
        role: 'PILOT' // Usa PILOT per gli operatori
      }
    });

    // Crea operator profile
    const operatorProfile = await prisma.operatorProfile.upsert({
      where: {
        org_id_user_id: {
          org_id: lenziOrg.id,
          user_id: user.id
        }
      },
      update: {
        max_hours_per_day: op.operatorProfile.max_hours_per_day,
        max_ha_per_day: op.operatorProfile.max_ha_per_day,
        service_tags: op.operatorProfile.service_tags,
        status: op.operatorProfile.status,
        home_location_id: location.id
      },
      create: {
        org_id: lenziOrg.id,
        user_id: user.id,
        home_location_id: location.id,
        max_hours_per_day: op.operatorProfile.max_hours_per_day,
        max_ha_per_day: op.operatorProfile.max_ha_per_day,
        service_tags: op.operatorProfile.service_tags,
        status: op.operatorProfile.status
      }
    });

    createdOperators.push({ user, operatorProfile });
  }
  console.log(`✅ Creati ${createdOperators.length} operatori`);

  // 5. Trova o crea buyer organization per i booking
  let buyerOrg = await prisma.organization.findFirst({
    where: {
      org_type: 'FARM',
      legal_name: { contains: 'Agricola' }
    }
  });

  if (!buyerOrg) {
    buyerOrg = await prisma.organization.create({
      data: {
        legal_name: 'Azienda Agricola Demo S.r.l.',
        vat_number: 'IT12345678902',
        org_type: 'FARM',
        address_line: 'Via dei Campi 45',
        city: 'Rovereto',
        province: 'TN',
        region: 'Trentino-Alto Adige',
        country: 'IT',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Creata organizzazione buyer demo');
  }

  // 6. Crea Service Sites
  console.log('📍 Creazione service sites...');
  const serviceSites = [
    {
      name: 'Campo Nord - Frutteto',
      address: 'Località Campi Nord, Rovereto (TN)',
      lat: 45.8886,
      lon: 11.0417,
      municipality_code: 'H612',
      province_code: 'TN'
    },
    {
      name: 'Campo Sud - Vigneto',
      address: 'Località Campi Sud, Trento (TN)',
      lat: 46.0748,
      lon: 11.1217,
      municipality_code: 'L378',
      province_code: 'TN'
    },
    {
      name: 'Campo Est - Cereali',
      address: 'Località Campi Est, Pergine (TN)',
      lat: 46.0614,
      lon: 11.2383,
      municipality_code: 'G452',
      province_code: 'TN'
    }
  ];

  const createdSites = [];
  for (const site of serviceSites) {
    const serviceSite = await prisma.serviceSite.upsert({
      where: {
        id: `site_${site.name.toLowerCase().replace(/\s+/g, '_')}`
      },
      update: site,
      create: {
        id: `site_${site.name.toLowerCase().replace(/\s+/g, '_')}`,
        buyer_org_id: buyerOrg.id,
        ...site
      }
    });
    createdSites.push(serviceSite);
  }
  console.log(`✅ Creati ${createdSites.length} service sites`);

  // 7. Trova asset (droni) disponibili
  const assets = await prisma.asset.findMany({
    where: {
      owning_org_id: lenziOrg.id,
      asset_status: 'AVAILABLE'
    },
    take: 3
  });

  if (assets.length === 0) {
    console.log('⚠️  Nessun asset trovato, creo asset demo...');
    // Crea asset demo - trova SKU invece di prodotti
    const skus = await prisma.sku.findMany({
      where: { 
        status: 'ACTIVE',
        product: {
          product_type: 'DRONE',
          status: 'ACTIVE'
        }
      },
      include: { product: true },
      take: 3
    });

    for (let i = 0; i < Math.min(3, skus.length); i++) {
      const asset = await prisma.asset.create({
        data: {
          owning_org_id: lenziOrg.id,
          managed_by_org_id: lenziOrg.id,
          sku_id: skus[i].id,
          serial_number: `DEMO-${skus[i].product.model}-${i + 1}`,
          asset_status: 'AVAILABLE',
          home_location_id: location.id
        }
      });
      assets.push(asset);
    }
  }

  // 8. Crea Bookings e Missioni
  console.log('📅 Creazione bookings e missioni...');
  const now = new Date();
  const bookings = [];

  for (let i = 0; i < 5; i++) {
    const daysAgo = i * 7; // Una settimana tra ogni booking
    const bookingDate = new Date(now);
    bookingDate.setDate(bookingDate.getDate() - daysAgo);

    const site = createdSites[i % createdSites.length];
    const operator = createdOperators[i % createdOperators.length];
    const asset = assets[i % assets.length];
    const serviceType = ['SPRAY', 'SPREAD', 'MAPPING'][i % 3] as 'SPRAY' | 'SPREAD' | 'MAPPING';

    // Crea booking
    const booking = await prisma.booking.create({
      data: {
        buyer_org_id: buyerOrg.id,
        seller_org_id: lenziOrg.id,
        executor_org_id: lenziOrg.id,
        service_type: serviceType,
        status: i < 2 ? 'DONE' : i === 2 ? 'IN_PROGRESS' : 'CONFIRMED',
        service_site_id: site.id,
        site_snapshot_json: {
          name: site.name,
          address: site.address,
          lat: site.lat?.toString(),
          lon: site.lon?.toString(),
          requested_area_ha: 10 + Math.random() * 20 // 10-30 ha
        },
        booking_slots: {
          create: {
            start_at: bookingDate,
            end_at: new Date(bookingDate.getTime() + 4 * 60 * 60 * 1000),
            timezone: 'Europe/Rome',
            buffer_minutes: 30
          }
        },
        booking_assignments: {
          create: {
            asset_id: asset.id,
            pilot_user_id: operator.user.id,
            status: 'ASSIGNED'
          }
        }
      },
      include: {
        booking_slots: true,
        booking_assignments: true
      }
    });

    // Crea missione se booking è DONE o IN_PROGRESS
    if (booking.status === 'DONE' || booking.status === 'IN_PROGRESS') {
      const slot = booking.booking_slots[0];
      // Generate realistic area data (10-50 hectares with some variation)
      const baseArea = 10 + Math.random() * 40;
      const actualArea = baseArea * (0.9 + Math.random() * 0.2); // ±10% variazione
      const actualHours = 3 + Math.random() * 2; // 3-5 ore

      await prisma.mission.create({
        data: {
          booking_id: booking.id,
          booking_slot_id: slot.id,
          executed_start_at: slot.start_at,
          executed_end_at: booking.status === 'DONE' ? slot.end_at : null,
          actual_area_ha: actualArea,
          actual_hours: booking.status === 'DONE' ? actualHours : null,
          notes: booking.status === 'DONE' 
            ? `Missione completata con successo. Condizioni meteo ottimali.`
            : `Missione in corso. Operatore ${operator.user.first_name} ${operator.user.last_name} sul campo.`
        }
      });
    }

    bookings.push(booking);
  }

  console.log(`✅ Creati ${bookings.length} bookings con relative missioni`);

  console.log('\n✅ Completato! Dati creati:');
  console.log(`   - ${rateCards.length} Rate Cards (servizi)`);
  console.log(`   - ${createdOperators.length} Operatori`);
  console.log(`   - ${createdSites.length} Service Sites`);
  console.log(`   - ${bookings.length} Bookings`);
  console.log(`   - ${bookings.filter(b => b.status === 'DONE' || b.status === 'IN_PROGRESS').length} Missioni`);
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

