/**
 * Script per trovare i PDF del T70P nel bucket Supabase
 */

// Configurazione Supabase da variabili d'ambiente
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Errore: SUPABASE_URL e SUPABASE_ANON_KEY devono essere configurati nelle variabili d'ambiente",
  );
  process.exit(1);
}

async function listBucketFiles(prefix = "") {
  const url = `${supabaseUrl}/storage/v1/object/list/Media FIle?prefix=${encodeURIComponent(prefix)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

async function findT70PPdfs() {
  try {
    console.log('🔍 Esplorando bucket "Media FIle" per PDF del T70P...');

    // Lista tutti i file nella root
    const rootFiles = await listBucketFiles();
    console.log(`📁 Trovati ${rootFiles.length} file nella root del bucket`);

    // Filtra file PDF che contengono "t70p" o "T70P" nel nome
    const t70pPdfs = rootFiles.filter((file) => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith(".pdf") &&
        (name.includes("t70p") || name.includes("t70") || name.includes("t 70"))
      );
    });

    console.log(
      `📄 Trovati ${t70pPdfs.length} PDF potenzialmente del T70P nella root:`,
    );
    t70pPdfs.forEach((pdf) => {
      const url = `${supabaseUrl}/storage/v1/object/public/Media FIle/${pdf.name}`;
      console.log(
        `  - ${pdf.name} (${(pdf.metadata?.size / 1024 / 1024)?.toFixed(2) || "N/A"} MB)`,
      );
      console.log(`    URL: ${url}`);
    });

    // Cerca sottocartelle
    const folders = [
      ...new Set(
        rootFiles
          .filter((f) => f.name.includes("/"))
          .map((f) => f.name.split("/")[0]),
      ),
    ];
    console.log(`\n📂 Sottocartelle trovate: ${folders.join(", ")}`);

    // Esplora cartelle che potrebbero contenere PDF
    const foldersToCheck = [
      "manuals",
      "pdfs",
      "docs",
      "documents",
      "t70p",
      "T70P",
    ];
    for (const folder of foldersToCheck.filter((f) => folders.includes(f))) {
      console.log(`\n🔍 Esplorando cartella "${folder}"...`);
      try {
        const folderFiles = await listBucketFiles(`${folder}/`);
        const folderT70p = folderFiles.filter(
          (file) =>
            file.name.toLowerCase().endsWith(".pdf") &&
            (file.name.toLowerCase().includes("t70p") ||
              file.name.toLowerCase().includes("t70") ||
              folder.toLowerCase().includes("t70")),
        );

        console.log(`  Trovati ${folderT70p.length} PDF in "${folder}":`);
        folderT70p.forEach((file) => {
          const url = `${supabaseUrl}/storage/v1/object/public/Media FIle/${folder}/${file.name}`;
          console.log(`    - ${file.name}`);
          console.log(`      URL: ${url}`);
        });
      } catch (error) {
        console.log(`  ❌ Errore esplorando "${folder}":`, error.message);
      }
    }

    // Cerca anche file che iniziano con "t70p" ovunque
    console.log('\n🔍 Cercando tutti i file che contengono "t70p"...');
    const allT70pFiles = rootFiles.filter((file) => {
      const name = file.name.toLowerCase();
      return name.includes("t70p") || name.includes("t70");
    });

    console.log(
      `Trovati ${allT70pFiles.length} file che contengono "t70p" o "t70":`,
    );
    allT70pFiles.forEach((file) => {
      const url = `${supabaseUrl}/storage/v1/object/public/Media FIle/${file.name}`;
      console.log(`  - ${file.name} (${file.metadata?.mimetype || "N/A"})`);
      console.log(`    URL: ${url}`);
    });
  } catch (error) {
    console.error("❌ Errore:", error);
  }
}

findT70PPdfs();
