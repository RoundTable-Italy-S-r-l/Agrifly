const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkUserDetails() {
  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    // Verifica utente e membership
    const result = await client.query(
      `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.status,
        u.password_hash IS NOT NULL as has_password,
        u.password_salt IS NOT NULL as has_salt,
        LENGTH(u.password_hash) as hash_length,
        LENGTH(u.password_salt) as salt_length,
        om.role as membership_role, om.is_active as membership_active,
        o.id as org_id, o.legal_name, o.type as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1
    `,
      ["giacomocavalcabo13@gmail.com"],
    );

    if (result.rows.length === 0) {
      console.log("❌ Utente NON trovato su Supabase");
    } else {
      const user = result.rows[0];
      console.log("✅ Utente trovato:");
      console.log("  ID:", user.id);
      console.log("  Email:", user.email);
      console.log("  Nome:", user.first_name, user.last_name);
      console.log("  Status:", user.status);
      console.log("  Has password_hash:", user.has_password);
      console.log("  Has password_salt:", user.has_salt);
      console.log("  Hash length:", user.hash_length);
      console.log("  Salt length:", user.salt_length);
      console.log("  Membership role:", user.membership_role || "Nessuna");
      console.log("  Membership active:", user.membership_active);
      console.log("  Org ID:", user.org_id || "Nessuna");
      console.log("  Org name:", user.legal_name || "Nessuna");
      console.log("  Org type:", user.org_type || "Nessuna");
    }

    await client.end();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    process.exit(1);
  }
}

checkUserDetails();
