/**
 * Script per listare tutti i contenuti del bucket Supabase "Media File"
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica variabili d'ambiente da .env
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Configurazione Supabase da variabili d'ambiente
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prova prima SERVICE_ROLE_KEY (per operazioni admin), poi ANON_KEY
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Errore: SUPABASE_URL e SUPABASE_ANON_KEY devono essere configurati nelle variabili d'ambiente",
  );
  process.exit(1);
}

// Prova diversi nomi possibili del bucket
const POSSIBLE_BUCKET_NAMES = [
  "Media File",
  "Media FIle",
  "media-file",
  "mediafile",
  "MediaFile",
];
let BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "Media File";

async function listBucketFiles(prefix = "", bucketName = BUCKET_NAME) {
  // Prova diversi modi di encoding per il nome del bucket
  const encodedBucket = encodeURIComponent(bucketName);
  // Prova anche con spazi come %20 invece di +
  const encodedBucketAlt = bucketName.replace(/ /g, "%20");

  const urls = [
    `${supabaseUrl}/storage/v1/object/list/${encodedBucket}?prefix=${encodeURIComponent(prefix)}`,
    `${supabaseUrl}/storage/v1/object/list/${encodedBucketAlt}?prefix=${encodeURIComponent(prefix)}`,
    // Prova anche senza encoding
    `${supabaseUrl}/storage/v1/object/list/${bucketName}?prefix=${encodeURIComponent(prefix)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (e) {
      // Continua con il prossimo URL
    }
  }

  // Se nessun URL funziona, lancia errore
  throw new Error(
    `Impossibile accedere al bucket "${bucketName}" con nessun metodo di encoding`,
  );
}

async function exploreBucket(prefix = "", depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return;

  try {
    const files = await listBucketFiles(prefix);

    if (!files || files.length === 0) {
      if (prefix) {
        console.log(`${"  ".repeat(depth)}📁 ${prefix} (vuota)`);
      }
      return;
    }

    // Separa file e cartelle
    const folders = new Set();
    const fileList = [];

    files.forEach((file) => {
      const fullPath = prefix ? `${prefix}${file.name}` : file.name;

      if (file.name.includes("/")) {
        // È una cartella
        const folderName = file.name.split("/")[0];
        folders.add(folderName);
      } else {
        // È un file
        fileList.push({
          name: file.name,
          fullPath: fullPath,
          size: file.metadata?.size || 0,
          mimetype: file.metadata?.mimetype || "N/A",
          updated: file.updated_at || file.created_at || "N/A",
        });
      }
    });

    // Mostra cartella corrente
    if (prefix || depth === 0) {
      const displayName = prefix || "ROOT";
      console.log(`\n${"  ".repeat(depth)}📂 ${displayName}`);
    }

    // Mostra file nella cartella corrente
    if (fileList.length > 0) {
      fileList.forEach((file) => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const url = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(BUCKET_NAME)}/${file.fullPath}`;
        console.log(`${"  ".repeat(depth + 1)}📄 ${file.name}`);
        console.log(`${"  ".repeat(depth + 2)}   Tipo: ${file.mimetype}`);
        console.log(`${"  ".repeat(depth + 2)}   Dimensione: ${sizeMB} MB`);
        console.log(`${"  ".repeat(depth + 2)}   Path: ${file.fullPath}`);
        console.log(`${"  ".repeat(depth + 2)}   URL: ${url}`);
      });
    }

    // Esplora sottocartelle
    for (const folder of Array.from(folders).sort()) {
      const newPrefix = prefix ? `${prefix}${folder}/` : `${folder}/`;
      await exploreBucket(newPrefix, depth + 1, maxDepth);
    }
  } catch (error) {
    console.error(`❌ Errore esplorando "${prefix}":`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

async function findBucket() {
  // Prova a trovare il bucket corretto
  for (const bucketName of POSSIBLE_BUCKET_NAMES) {
    try {
      await listBucketFiles("", bucketName);
      console.log(`✅ Bucket trovato: "${bucketName}"`);
      return bucketName;
    } catch (e) {
      // Continua con il prossimo nome
      console.log(`   ❌ "${bucketName}" non trovato`);
    }
  }

  // Se non trovato, prova a listare tutti i bucket (richiede SERVICE_KEY)
  try {
    const url = `${supabaseUrl}/storage/v1/bucket`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
    });

    if (response.ok) {
      const buckets = await response.json();
      console.log("\n📦 Bucket disponibili:");
      buckets.forEach((b) => {
        console.log(`  - "${b.name}" (${b.public ? "pubblico" : "privato"})`);
      });
      if (buckets.length > 0) {
        return buckets[0].name; // Usa il primo bucket trovato
      }
    } else {
      console.log(
        `   ⚠️  Impossibile listare bucket (HTTP ${response.status})`,
      );
    }
  } catch (e) {
    console.error("❌ Impossibile listare i bucket:", e.message);
  }

  return null;
}

async function main() {
  try {
    console.log("🔍 Esplorando bucket Supabase Storage...");
    console.log(`🌐 URL: ${supabaseUrl}`);
    console.log("=".repeat(80));

    // Trova il bucket corretto
    const foundBucket = await findBucket();
    if (!foundBucket) {
      console.error(
        "❌ Bucket non trovato. Verifica il nome del bucket nelle variabili d'ambiente.",
      );
      process.exit(1);
    }

    BUCKET_NAME = foundBucket;
    console.log(`📦 Usando bucket: "${BUCKET_NAME}"`);
    console.log("=".repeat(80));

    await exploreBucket();

    console.log("\n" + "=".repeat(80));
    console.log("✅ Esplorazione completata");
  } catch (error) {
    console.error("❌ Errore:", error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
