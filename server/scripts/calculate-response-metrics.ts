/**
 * Script per calcolare le metriche di risposta ai messaggi
 * Eseguire periodicamente (es. ogni 6 ore) per aggiornare le metriche
 *
 * Usage: tsx server/scripts/calculate-response-metrics.ts
 */

import "dotenv/config";
import { processAllOpenConversations } from "../utils/response-metrics";

async function main() {
  console.log("🚀 Avvio calcolo response metrics...\n");

  try {
    // Processa conversation degli ultimi 7 giorni
    const result = await processAllOpenConversations(7);

    console.log("✅ Calcolo completato:");
    console.log(`  - Conversation processate: ${result.processed}`);
    console.log(`  - Eventi creati: ${result.eventsCreated}`);
    console.log(`  - Metriche aggregate aggiornate`);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Errore durante il calcolo:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
