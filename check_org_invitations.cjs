require('dotenv').config();
const { Client } = require('pg');

async function checkOrgInvitations() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'organization_invitations' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('\norganization_invitations columns:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'}) ${col.column_default ? 'default: ' + col.column_default : ''}`);
    });

    // Also check if there are any invitations with status
    const sampleData = await client.query('SELECT id, status FROM organization_invitations LIMIT 5');
    console.log('\nSample invitation data:');
    sampleData.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Status: ${row.status}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkOrgInvitations();
