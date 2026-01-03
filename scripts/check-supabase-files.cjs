require("dotenv").config();

async function checkSupabaseFiles() {
  console.log("=== VERIFICA FILE SUPABASE ===");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "Media FIle";

  console.log("Bucket:", bucketName);
  console.log("URL:", supabaseUrl);
  console.log("Key presente:", !!supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Credenziali Supabase mancanti");
    return;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lista contenuti root
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from(bucketName)
      .list("", { limit: 100 });

    if (rootError) {
      console.log("❌ Errore root:", rootError.message);
      return;
    }

    console.log("\n=== CARTELLE NEL BUCKET ===");
    rootFiles?.forEach((f) => {
      if (!f.id) {
        // È una cartella
        console.log("📁", f.name);
      }
    });

    // Controlla cartelle specifiche
    const folders = ["glb", "images", "videos", "manuals", "pdf"];

    for (const folder of folders) {
      console.log(`\n=== ${folder.toUpperCase()} ===`);
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folder, { limit: 100 });

      if (error) {
        console.log("❌ Errore:", error.message);
      } else {
        console.log("File trovati:", files?.length || 0);
        if (files && files.length > 0) {
          files.slice(0, 10).forEach((f) => {
            if (f.id) {
              // È un file
              console.log("📄", f.name);
            } else {
              // È una sottocartella
              console.log("📁", f.name + "/");
            }
          });
        }
      }
    }

    // Controlla specificamente manuals/t25
    console.log("\n=== MANUALS/T25 ===");
    const { data: t25Files, error: t25Error } = await supabase.storage
      .from(bucketName)
      .list("manuals/t25", { limit: 50 });

    if (t25Error) {
      console.log("❌ Errore manuals/t25:", t25Error.message);
    } else {
      console.log("File in manuals/t25:", t25Files?.length || 0);
      t25Files?.forEach((f) => console.log("📄", f.name));
    }

    // Controlla manuals/t25p
    console.log("\n=== MANUALS/T25P ===");
    const { data: t25pFiles, error: t25pError } = await supabase.storage
      .from(bucketName)
      .list("manuals/t25p", { limit: 50 });

    if (t25pError) {
      console.log("❌ Errore manuals/t25p:", t25pError.message);
    } else {
      console.log("File in manuals/t25p:", t25pFiles?.length || 0);
      t25pFiles?.forEach((f) => console.log("📄", f.name));
    }

    // Controlla pdf/ (dove probabilmente sono i manuali)
    console.log("\n=== PDF/ ===");
    const { data: pdfFiles, error: pdfError } = await supabase.storage
      .from(bucketName)
      .list("pdf", { limit: 100 });

    if (pdfError) {
      console.log("❌ Errore pdf:", pdfError.message);
    } else {
      console.log("File in pdf:", pdfFiles?.length || 0);
      pdfFiles?.forEach((f) => {
        if (f.id) {
          console.log("📄", f.name);
        } else {
          console.log("📁", f.name + "/");
        }
      });
    }

    // Controlla pdf/t25p se esiste
    console.log("\n=== PDF/T25P ===");
    const { data: pdfT25pFiles, error: pdfT25pError } = await supabase.storage
      .from(bucketName)
      .list("pdf/t25p", { limit: 50 });

    if (pdfT25pError) {
      console.log("❌ Errore pdf/t25p:", pdfT25pError.message);
    } else {
      console.log("File in pdf/t25p:", pdfT25pFiles?.length || 0);
      pdfT25pFiles?.forEach((f) => console.log("📄", f.name));
    }

    // Controlla videos/t25 per vedere se ci sono video per T25
    console.log("\n=== VIDEOS/T25 ===");
    const { data: videosT25Files, error: videosT25Error } =
      await supabase.storage.from(bucketName).list("videos/t25", { limit: 50 });

    if (videosT25Error) {
      console.log("❌ Errore videos/t25:", videosT25Error.message);
    } else {
      console.log("File in videos/t25:", videosT25Files?.length || 0);
      videosT25Files?.forEach((f) => {
        if (f.id) {
          console.log("🎬", f.name, `(${f.metadata?.size || "N/A"} bytes)`);
        } else {
          console.log("📁", f.name + "/");
        }
      });
    }

    // Controlla images/t25 per vedere se ci sono immagini per T25
    console.log("\n=== IMAGES/T25 ===");
    const { data: imagesT25Files, error: imagesT25Error } =
      await supabase.storage.from(bucketName).list("images/t25", { limit: 50 });

    if (imagesT25Error) {
      console.log("❌ Errore images/t25:", imagesT25Error.message);
    } else {
      console.log("File in images/t25:", imagesT25Files?.length || 0);
      imagesT25Files?.forEach((f) => {
        if (f.id) {
          console.log("🖼️ ", f.name, `(${f.metadata?.size || "N/A"} bytes)`);
        } else {
          console.log("📁", f.name + "/");
        }
      });
    }
  } catch (error) {
    console.log("❌ Errore:", error.message);
  }
}

checkSupabaseFiles();
