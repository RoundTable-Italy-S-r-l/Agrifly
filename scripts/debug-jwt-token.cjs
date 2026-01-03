const { verifyJWT } = require("../server/utils/auth");

// Simula un token JWT (devi passare il token reale dalla console del browser)
const token = process.argv[2];

if (!token) {
  console.log("❌ Usage: node scripts/debug-jwt-token.cjs <JWT_TOKEN>");
  console.log("");
  console.log("Per ottenere il token:");
  console.log("1. Apri la console del browser (F12)");
  console.log('2. Esegui: localStorage.getItem("auth_token")');
  console.log("3. Copia il token e passalo come argomento");
  process.exit(1);
}

try {
  console.log("🔍 Analisi token JWT:");
  console.log("Token (primi 50 caratteri):", token.substring(0, 50) + "...");
  console.log("");

  const decoded = verifyJWT(token);

  if (!decoded) {
    console.log("❌ Token invalido o scaduto");
    process.exit(1);
  }

  console.log("✅ Token valido!");
  console.log("");
  console.log("📋 Payload decodificato:");
  console.log(JSON.stringify(decoded, null, 2));
  console.log("");

  console.log("🔍 Valori chiave:");
  console.log(`  userId: ${decoded.userId}`);
  console.log(`  orgId: ${decoded.orgId}`);
  console.log(`  organizationId: ${decoded.organizationId}`);
  console.log(`  role: ${decoded.role}`);
  console.log(`  isAdmin: ${decoded.isAdmin}`);
  console.log("");

  const organizationId = decoded.orgId || decoded.organizationId;
  console.log(`📍 organizationId calcolato: ${organizationId}`);
  console.log(
    `📍 Confronto con lenzi-org-id: ${organizationId === "lenzi-org-id" ? "✅ MATCH" : "❌ NO MATCH"}`,
  );
} catch (error) {
  console.error("❌ Errore:", error.message);
  console.error(error.stack);
}
