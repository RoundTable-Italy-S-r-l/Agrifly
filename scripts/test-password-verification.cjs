const { Client } = require("pg");
const { pbkdf2Sync, timingSafeEqual } = require("crypto");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

function verifyPassword(password, storedHash, storedSalt) {
  try {
    const saltBytes = Buffer.from(storedSalt, "hex");
    const computedHash = pbkdf2Sync(
      password,
      saltBytes,
      100000,
      64,
      "sha256",
    ).toString("hex");
    return timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(storedHash, "hex"),
    );
  } catch (error) {
    console.error("Errore verifica password:", error.message);
    return false;
  }
}

async function testPassword() {
  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    const email = "giacomocavalcabo13@gmail.com";
    const testPassword = "password";

    // Recupera utente
    const userResult = await client.query(
      `
      SELECT id, email, password_hash, password_salt
      FROM users
      WHERE email = $1
    `,
      [email],
    );

    if (userResult.rows.length === 0) {
      console.log("❌ Utente non trovato");
      await client.end();
      return;
    }

    const user = userResult.rows[0];
    console.log("✅ Utente trovato:", user.email);
    console.log("  - Password hash length:", user.password_hash?.length || 0);
    console.log("  - Password salt length:", user.password_salt?.length || 0);
    console.log(
      "  - Password hash (first 20):",
      user.password_hash?.substring(0, 20) || "N/A",
    );
    console.log(
      "  - Password salt (first 20):",
      user.password_salt?.substring(0, 20) || "N/A",
    );

    if (!user.password_hash || !user.password_salt) {
      console.log("❌ Password hash o salt mancanti!");
      await client.end();
      return;
    }

    // Test verifica password
    console.log("\n🔐 Test verifica password...");
    console.log("  - Password da testare:", testPassword);

    const isValid = verifyPassword(
      testPassword,
      user.password_hash,
      user.password_salt,
    );
    console.log(
      "  - Risultato verifica:",
      isValid ? "✅ VALIDA" : "❌ NON VALIDA",
    );

    if (!isValid) {
      console.log("\n⚠️  Password non corrisponde!");
      console.log(
        "  - Hash memorizzato:",
        user.password_hash.substring(0, 40) + "...",
      );

      // Prova a ricalcolare l'hash
      console.log("\n🔄 Test ricalcolo hash...");
      const { randomBytes } = require("crypto");
      const testSaltBytes = randomBytes(16);
      const testSalt = testSaltBytes.toString("hex");
      const testHash = pbkdf2Sync(
        testPassword,
        testSaltBytes,
        100000,
        64,
        "sha256",
      ).toString("hex");
      console.log("  - Nuovo salt length:", testSalt.length);
      console.log("  - Nuovo hash length:", testHash.length);

      // Verifica che il nuovo hash funzioni
      const testVerify = verifyPassword(testPassword, testHash, testSalt);
      console.log(
        "  - Verifica nuovo hash:",
        testVerify ? "✅ OK" : "❌ ERRORE",
      );
    }

    await client.end();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error("Stack:", error.stack?.split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
}

testPassword();
