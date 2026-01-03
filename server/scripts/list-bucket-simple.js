/**
 * Script semplice per listare i contenuti del bucket Supabase usando il client JavaScript
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica variabili d'ambiente
dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "Media FIle";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Errore: SUPABASE_URL e SUPABASE_KEY devono essere configurati",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles(path = "", depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return;

  try {
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(path, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error(`❌ Errore listando "${path}":`, error.message);
      return;
    }

    if (!files || files.length === 0) {
      if (path) {
        console.log(`${"  ".repeat(depth)}📁 ${path} (vuota)`);
      }
      return;
    }

    // Mostra cartella corrente
    if (path || depth === 0) {
      const displayName = path || "ROOT";
      console.log(`\n${"  ".repeat(depth)}📂 ${displayName}`);
    }

    // Separa file e cartelle
    const folders = [];
    const fileList = [];

    files.forEach((file) => {
      if (file.id === null) {
        // È una cartella
        folders.push(file.name);
      } else {
        // È un file
        fileList.push(file);
      }
    });

    // Mostra file
    if (fileList.length > 0) {
      fileList.forEach((file) => {
        const sizeMB = (file.metadata?.size / 1024 / 1024)?.toFixed(2) || "0";
        const fullPath = path ? `${path}/${file.name}` : file.name;
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fullPath);

        console.log(`${"  ".repeat(depth + 1)}📄 ${file.name}`);
        console.log(
          `${"  ".repeat(depth + 2)}   Tipo: ${file.metadata?.mimetype || "N/A"}`,
        );
        console.log(`${"  ".repeat(depth + 2)}   Dimensione: ${sizeMB} MB`);
        console.log(`${"  ".repeat(depth + 2)}   Path: ${fullPath}`);
        console.log(`${"  ".repeat(depth + 2)}   URL: ${urlData.publicUrl}`);
      });
    }

    // Esplora sottocartelle
    for (const folder of folders.sort()) {
      const newPath = path ? `${path}/${folder}` : folder;
      await listFiles(newPath, depth + 1, maxDepth);
    }
  } catch (error) {
    console.error(`❌ Errore esplorando "${path}":`, error.message);
  }
}

async function main() {
  try {
    console.log("🔍 Esplorando bucket Supabase Storage...");
    console.log(`📦 Bucket: "${bucketName}"`);
    console.log(`🌐 URL: ${supabaseUrl}`);
    console.log("=".repeat(80));

    await listFiles();

    console.log("\n" + "=".repeat(80));
    console.log("✅ Esplorazione completata");
  } catch (error) {
    console.error("❌ Errore:", error);
    process.exit(1);
  }
}

main();
