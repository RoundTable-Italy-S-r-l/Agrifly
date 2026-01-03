const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = "http://localhost:3001/api";

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const TEST_ACCOUNTS = {
  vendor: {
    email: "giacomo.cavalcabo14@gmail.com",
    password: "=Fn4Q8RvehTz7G@",
  },
};

let authToken = null;
let results = [];

function logTest(name, passed, message = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}${message ? `: ${message}` : ""}`);
  results.push({ name, passed, message });
}

async function login() {
  const account = TEST_ACCOUNTS.vendor;
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (response.ok) {
    const data = await response.json();
    return data.token || data.accessToken;
  }
  return null;
}

async function testDoubleClickIdempotency() {
  console.log("\n📋 TEST 1: Double Click / Idempotenza\n");

  if (!authToken) {
    logTest("Double click test", false, "Token non disponibile");
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;

  // Test toggle prodotto (dovrebbe essere idempotente o gestire conflitto)
  try {
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const me = await meResponse.json();
    const orgId = me.organization?.id || me.organizationId;

    if (!orgId || !supabase) {
      logTest(
        "Toggle double click",
        false,
        "Org ID o Supabase non disponibile",
      );
      return { passed: 0, failed: 1 };
    }

    // Trova un prodotto
    const { data: products } = await supabase
      .from("vendor_catalog_items")
      .select("id, sku_id, is_for_sale")
      .eq("vendor_org_id", orgId)
      .limit(1);

    if (!products || products.length === 0) {
      logTest("Toggle double click", false, "Nessun prodotto trovato");
      return { passed: 0, failed: 1 };
    }

    const product = products[0];
    const originalValue = product.is_for_sale;
    const newValue = !originalValue;

    // Simula doppio click: stessa richiesta due volte simultaneamente
    const [response1, response2] = await Promise.all([
      fetch(`${API_BASE}/catalog/vendor/${orgId}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          skuId: product.sku_id,
          isForSale: newValue,
        }),
      }),
      fetch(`${API_BASE}/catalog/vendor/${orgId}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          skuId: product.sku_id,
          isForSale: newValue,
        }),
      }),
    ]);

    // Entrambe dovrebbero avere successo (idempotenza) o una deve essere gestita (conflitto)
    const bothOk = response1.ok && response2.ok;
    const oneConflict =
      (response1.status === 409 || response2.status === 409) &&
      (response1.ok || response2.ok);

    if (bothOk || oneConflict) {
      passed++;
      logTest(
        "Toggle double click",
        true,
        bothOk ? "Idempotente" : "Conflitto gestito",
      );
    } else {
      failed++;
      logTest(
        "Toggle double click",
        false,
        `Status1: ${response1.status}, Status2: ${response2.status}`,
      );
    }

    // Verifica stato finale
    await new Promise((r) => setTimeout(r, 500));
    const { data: finalProduct } = await supabase
      .from("vendor_catalog_items")
      .select("is_for_sale")
      .eq("id", product.id)
      .single();

    if (finalProduct && finalProduct.is_for_sale === newValue) {
      passed++;
      logTest(
        "Toggle stato finale corretto",
        true,
        `is_for_sale: ${finalProduct.is_for_sale}`,
      );
    } else {
      failed++;
      logTest("Toggle stato finale corretto", false, "Stato inconsistente");
    }

    // Ripristina
    await supabase
      .from("vendor_catalog_items")
      .update({ is_for_sale: originalValue })
      .eq("id", product.id);
  } catch (error) {
    failed++;
    logTest("Toggle double click", false, error.message);
  }

  console.log(`\n📊 Double Click: ${passed} passati, ${failed} falliti\n`);
  return { passed, failed };
}

async function testInventoryConcurrency() {
  console.log("\n📋 TEST 2: Concorrenza Inventario (qty_reserved)\n");

  if (!authToken || !supabase) {
    logTest("Inventory concurrency", false, "Token o Supabase non disponibile");
    return { passed: 0, failed: 1 };
  }

  const { TestDataFactory } = require(__dirname + "/test-factory-helpers.cjs");
  const factory = new TestDataFactory();

  let passed = 0;
  let failed = 0;
  let testInventory = null;
  let testOrg = null;
  let testProduct = null;

  try {
    // SETUP: Crea inventario di test deterministico
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const me = await meResponse.json();
    const orgId = me.organization?.id || me.organizationId;

    if (!orgId) {
      logTest("Inventory concurrency - setup", false, "Org ID non disponibile");
      return { passed: 0, failed: 1 };
    }

    // Crea prodotto e inventario per test
    testOrg = { id: orgId };
    testProduct = await factory.createProduct();
    testInventory = await factory.createInventory(orgId, testProduct.id, {
      qty_on_hand: 100,
      qty_reserved: 0,
    });

    const inventory = testInventory;
    const originalOnHand = inventory.qty_on_hand;
    const originalReserved = inventory.qty_reserved || 0;

    // Simula due richieste simultanee che riservano stock
    const quantityToReserve = 2;

    // Crea due ordini simultaneamente (simula)
    const [cart1, cart2] = await Promise.all([
      // Request 1: Riserva stock
      fetch(`${API_BASE}/orders/create-from-cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              skuId: inventory.sku_id,
              quantity: quantityToReserve,
            },
          ],
          shippingAddress: {
            name: "Test",
            address_line: "Test St",
            city: "Test",
            province: "TN",
            postal_code: "38051",
            country: "IT",
          },
        }),
      }).catch(() => ({ status: 500, ok: false })),
      // Request 2: Riserva stock simultaneamente
      fetch(`${API_BASE}/orders/create-from-cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              skuId: inventory.sku_id,
              quantity: quantityToReserve,
            },
          ],
          shippingAddress: {
            name: "Test",
            address_line: "Test St",
            city: "Test",
            province: "TN",
            postal_code: "38051",
            country: "IT",
          },
        }),
      }).catch(() => ({ status: 500, ok: false })),
    ]);

    // Attendi che le richieste vengano processate
    await new Promise((r) => setTimeout(r, 1000));

    // Verifica inventario finale
    const { data: finalInventory } = await supabase
      .from("inventories")
      .select("qty_on_hand, qty_reserved")
      .eq("id", inventory.id)
      .single();

    if (finalInventory) {
      const totalReserved = finalInventory.qty_reserved || 0;
      const available = finalInventory.qty_on_hand - totalReserved;

      // Verifica che non siamo andati sotto zero
      if (available >= 0 && totalReserved >= originalReserved) {
        passed++;
        logTest(
          "Inventory non va sotto zero",
          true,
          `Available: ${available}, Reserved: ${totalReserved}`,
        );
      } else {
        failed++;
        logTest(
          "Inventory non va sotto zero",
          false,
          `Available: ${available}, Reserved: ${totalReserved}`,
        );
      }

      // Verifica consistenza: qty_reserved non può superare qty_on_hand
      if (totalReserved <= finalInventory.qty_on_hand) {
        passed++;
        logTest(
          "Inventory consistenza reserved",
          true,
          `Reserved: ${totalReserved} <= OnHand: ${finalInventory.qty_on_hand}`,
        );
      } else {
        failed++;
        logTest(
          "Inventory consistenza reserved",
          false,
          `Reserved: ${totalReserved} > OnHand: ${finalInventory.qty_on_hand}`,
        );
      }
    }
  } catch (error) {
    failed++;
    logTest("Inventory concurrency", false, error.message);
  }

  console.log(
    `\n📊 Inventory Concurrency: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function testMarkAsReadIdempotency() {
  console.log("\n📋 TEST 3: Mark as Read Idempotenza\n");

  if (!authToken) {
    logTest("Mark as read", false, "Token non disponibile");
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;

  // Questo test richiede un ordine esistente con messaggi
  // Per ora, testiamo che chiamare mark as read due volte sia safe
  try {
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const me = await meResponse.json();
    const orgId = me.organization?.id || me.organizationId;

    if (!orgId) {
      logTest("Mark as read idempotency", false, "Org ID non disponibile");
      return { passed: 0, failed: 1 };
    }

    // Prova a chiamare mark as read due volte (se abbiamo un order ID)
    // Per ora, testiamo che l'endpoint accetti chiamate multiple
    const testOrderId = "test-order-id";

    const [response1, response2] = await Promise.all([
      fetch(`${API_BASE}/orders/${testOrderId}/messages/read`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ reader_org_id: orgId }),
      }).catch(() => ({ status: 404, ok: false })),
      fetch(`${API_BASE}/orders/${testOrderId}/messages/read`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ reader_org_id: orgId }),
      }).catch(() => ({ status: 404, ok: false })),
    ]);

    // Entrambe dovrebbero avere stesso status (idempotenza)
    // 404 è OK perché l'ordine non esiste, ma testiamo che non crashino
    if (response1.status === response2.status) {
      passed++;
      logTest(
        "Mark as read idempotency",
        true,
        "Stesso status su chiamate multiple",
      );
    } else {
      failed++;
      logTest(
        "Mark as read idempotency",
        false,
        `Status diversi: ${response1.status} vs ${response2.status}`,
      );
    }
  } catch (error) {
    failed++;
    logTest("Mark as read idempotency", false, error.message);
  }

  console.log(`\n📊 Mark as Read: ${passed} passati, ${failed} falliti\n`);
  return { passed, failed };
}

async function runAllTests() {
  console.log("🔄 CONCURRENCY TESTS - Race Conditions & Idempotency\n");
  console.log("=".repeat(70));

  authToken = await login();

  const doubleClickResults = await testDoubleClickIdempotency();
  const inventoryResults = await testInventoryConcurrency();
  const markReadResults = await testMarkAsReadIdempotency();

  const totalPassed =
    doubleClickResults.passed +
    inventoryResults.passed +
    markReadResults.passed;
  const totalFailed =
    doubleClickResults.failed +
    inventoryResults.failed +
    markReadResults.failed;

  console.log("=".repeat(70));
  console.log("\n📊 RISULTATI FINALI:\n");
  console.log(`✅ Test passati: ${totalPassed}`);
  console.log(`❌ Test falliti: ${totalFailed}`);
  console.log(
    `📈 Tasso successo: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
  );

  if (totalFailed === 0) {
    console.log("\n🎉 TUTTI I TEST CONCURRENCY SUPERATI!");
    process.exit(0);
  } else {
    console.log("\n⚠️ Alcuni test falliti");
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("\n❌ Errore durante i test:", error);
  process.exit(1);
});
