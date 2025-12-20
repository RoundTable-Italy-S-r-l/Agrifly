#!/usr/bin/env node

// Script per verificare lo stato del database
import 'dotenv/config'
import { PrismaClient } from './generated/prisma/client.js'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('🔍 Verifica stato database...\n')

  try {
    // Test connessione
    console.log('📡 Test connessione database...')
    await prisma.$connect()
    console.log('✅ Database connesso!\n')

    // Conteggi tabelle principali
    const tables = [
      { name: 'organizations', query: () => prisma.organization.count() },
      { name: 'users', query: () => prisma.user.count() },
      { name: 'org_memberships', query: () => prisma.orgMembership.count() },
      { name: 'organization_invitations', query: () => prisma.organizationInvitation.count() },
      { name: 'products', query: () => prisma.product.count() },
      { name: 'skus', query: () => prisma.sku.count() },
      { name: 'vendor_catalog_items', query: () => prisma.vendorCatalogItem.count() },
    ]

    console.log('📊 Conteggi tabelle:')
    for (const table of tables) {
      try {
        const count = await table.query()
        console.log(`  ${table.name}: ${count}`)
      } catch (err) {
        console.log(`  ${table.name}: ❌ Errore - ${err.message}`)
      }
    }

    // Verifica dati essenziali per le impostazioni
    console.log('\n🔧 Verifica dati per impostazioni:')

    const orgs = await prisma.organization.findMany({ take: 1 })
    if (orgs.length > 0) {
      console.log('✅ Organizzazioni presenti')

      const memberships = await prisma.orgMembership.findMany({
        where: { org_id: orgs[0].id },
        include: { user: true }
      })

      console.log(`✅ Membri organizzazione "${orgs[0].legal_name}": ${memberships.length}`)

      for (const membership of memberships) {
        console.log(`  - ${membership.user.first_name} ${membership.user.last_name} (${membership.role})`)
      }
    } else {
      console.log('❌ Nessuna organizzazione trovata')
    }

  } catch (error) {
    console.error('❌ Errore database:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
