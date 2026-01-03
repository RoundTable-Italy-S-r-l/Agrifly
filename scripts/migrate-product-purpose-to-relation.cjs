require("dotenv").config();
const { Client } = require("pg");

(async () => {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connesso al database");

    // Crea tabella product_purposes
    console.log("📋 Creo tabella product_purposes...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_purposes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        product_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT unique_product_purpose UNIQUE (product_id, purpose)
      )
    `);

    // Crea indici
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_purposes_product_id ON product_purposes(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_purposes_purpose ON product_purposes(purpose);
    `);
    console.log("✅ Tabella product_purposes creata");

    // Migra dati dalla colonna purpose (JSON) alla tabella di relazione
    console.log("📋 Migro dati da purpose (JSON) a product_purposes...");

    const products = await client.query(
      "SELECT id, name, purpose FROM products WHERE purpose IS NOT NULL",
    );

    for (const product of products.rows) {
      try {
        const purposes = JSON.parse(product.purpose);
        console.log(`  📦 ${product.name}: ${purposes.join(", ")}`);

        for (const purpose of purposes) {
          // Verifica che il purpose sia valido
          if (!["SPRAY", "SPREAD", "MAPPING"].includes(purpose)) {
            console.log(`    ⚠️  Purpose non valido: ${purpose}, skip`);
            continue;
          }

          // Inserisci nella tabella di relazione
          await client.query(
            `INSERT INTO product_purposes (product_id, purpose) 
             VALUES ($1, $2) 
             ON CONFLICT (product_id, purpose) DO NOTHING`,
            [product.id, purpose],
          );
        }
      } catch (error) {
        console.log(
          `    ❌ Errore parsing purpose per ${product.name}:`,
          error.message,
        );
      }
    }

    // Verifica risultati
    console.log("\n📋 Verifica product_purposes:");
    const verifyResult = await client.query(`
      SELECT p.name, pp.purpose 
      FROM products p
      JOIN product_purposes pp ON p.id = pp.product_id
      WHERE p.id IN ('prd_t100', 'prd_t25', 'prd_t25p', 'prd_t50', 'prd_t70p', 'prd_mavic3m')
      ORDER BY p.name, pp.purpose
    `);

    const grouped = {};
    verifyResult.rows.forEach((row) => {
      if (!grouped[row.name]) grouped[row.name] = [];
      grouped[row.name].push(row.purpose);
    });

    Object.entries(grouped).forEach(([name, purposes]) => {
      console.log(`  ${name}: ${purposes.join(", ")}`);
    });

    // Opzionale: rimuovi colonna purpose vecchia (commentato per sicurezza)
    // console.log('\n📋 Rimuovo colonna purpose vecchia...');
    // await client.query('ALTER TABLE products DROP COLUMN IF EXISTS purpose');
    // console.log('✅ Colonna purpose rimossa');

    await client.end();
    console.log("\n✅ Migrazione completata!");
    console.log(
      "💡 Nota: La colonna purpose vecchia è ancora presente. Puoi rimuoverla manualmente dopo verifica.",
    );
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
