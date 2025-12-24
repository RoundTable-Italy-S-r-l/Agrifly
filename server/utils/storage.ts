/**
 * Utility per costruire URL Supabase Storage
 * 
 * Regola: usa sempre SUPABASE_URL, non dedurre da DB host/pooler
 */

export function getSupabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing SUPABASE_URL env var. Set it in Netlify environment variables.");
  }
  
  return url.replace(/\/$/, ""); // Rimuovi trailing slash se presente
}

/**
 * Ottiene il nome del bucket da usare per i file GLB
 * Configurabile via env var, default: "product"
 */
export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "product";
}

/**
 * Costruisce URL per file pubblico in Supabase Storage
 * @param bucket Nome del bucket (default: da env var SUPABASE_STORAGE_BUCKET o "assets")
 * @param key Path del file nel bucket (es. "glb/t50/T50.glb" o "/glb/t50/T50.glb")
 * @returns URL completo per accedere al file
 */
export function publicObjectUrl(bucket?: string, key?: string): string {
  const base = getSupabaseUrl();
  const bucketName = bucket || getStorageBucket();
  const cleanKey = (key || "").trim().replace(/^\//, ""); // Rimuovi slash iniziale se presente
  
  if (!cleanKey) {
    throw new Error("Key (path) is required for publicObjectUrl");
  }
  
  return `${base}/storage/v1/object/public/${bucketName}/${cleanKey}`;
}

