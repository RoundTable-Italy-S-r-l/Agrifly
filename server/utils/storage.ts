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
    throw new Error(
      "Missing SUPABASE_URL env var. Set it in Netlify environment variables.",
    );
  }

  return url.replace(/\/$/, ""); // Rimuovi trailing slash se presente
}

/**
 * Ottiene il nome del bucket da usare per i file multimediali
 * Deve essere configurato via env var SUPABASE_STORAGE_BUCKET
 */
export function getStorageBucket(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      "Missing SUPABASE_STORAGE_BUCKET env var. Set it in Netlify environment variables.",
    );
  }
  return bucket;
}

/**
 * Costruisce URL per file pubblico in Supabase Storage
 * @param bucket Nome del bucket (default: da env var SUPABASE_STORAGE_BUCKET)
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

  // URL-encode il nome del bucket e la chiave per gestire spazi e caratteri speciali
  const encodedBucket = encodeURIComponent(bucketName);
  const encodedKey = encodeURIComponent(cleanKey).replace(/%2F/g, "/"); // Mantieni gli slash nel path

  return `${base}/storage/v1/object/public/${encodedBucket}/${encodedKey}`;
}
