const { Client } = require("pg");
const { randomBytes, pbkdf2Sync } = require("crypto");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

function hashPassword(password) {
  // Genera salt casuale 16 byte (32 caratteri hex)
  const saltBytes = randomBytes(16);
  const salt = saltBytes.toString("hex");

  // PBKDF2 con SHA256, 100.000 iterazioni
  const hash = pbkdf2Sync(password, saltBytes, 100000, 64, "sha256").toString(
    "hex",
  );

  return { salt, hash };
}

async function resetPassword() {
  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    const email = "giacomocavalcabo13@gmail.com";
    const newPassword = "password"; // Password da usare

    // Verifica che l'utente esista
    const userCheck = await client.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email],
    );

    if (userCheck.rows.length === 0) {
      console.log("❌ Utente non trovato:", email);
      await client.end();
      return;
    }

    console.log("✅ Utente trovato:", userCheck.rows[0].email);

    // Hash della nuova password
    const { salt, hash } = hashPassword(newPassword);
    console.log("🔐 Password hashata con PBKDF2");
    console.log("  Salt length:", salt.length);
    console.log("  Hash length:", hash.length);

    // Aggiorna password
    await client.query(
      "UPDATE users SET password_hash = $1, password_salt = $2 WHERE email = $3",
      [hash, salt, email],
    );

    console.log("✅ Password aggiornata con successo!");
    console.log("📝 Nuova password:", newPassword);

    await client.end();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    process.exit(1);
  }
}

resetPassword();
