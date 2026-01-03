const { createClient } = require("@supabase/supabase-js");
const { TestDataFactory } = require(__dirname + "/test-factory-helpers.cjs");
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
  buyer: {
    email: "giacomocavalcabo13@gmail.com",
    password: "password",
  },
};

let authTokens = {};
let factory = new TestDataFactory();
let results = [];

function logTest(name, passed, details = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}${details ? `: ${details}` : ""}`);
  results.push({ name, passed, details });
}

async function login(accountType) {
  const account = TEST_ACCOUNTS[accountType];
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

async function testOfferWriteReadBack() {
  console.log("\n📋 TEST 1: Offer - Write + Read-Back dal DB\n");

  if (!authTokens.vendor || !supabase) {
    logTest("Offer write-read", false, "Token o Supabase non disponibile");
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;
  let createdOfferId = null;

  try {
    // Write: Crea offerta via API
    const offerData = {
      offer_type: "PROMO",
      name: `DB Proof Test ${Date.now()}`,
      rules_json: { discount_percent: 15 },
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "ACTIVE",
    };

    const createResponse = await fetch(`${API_BASE}/offers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authTokens.vendor}`,
      },
      body: JSON.stringify(offerData),
    });

    if (!createResponse.ok) {
      failed++;
      logTest(
        "Offer creation via API",
        false,
        `Status: ${createResponse.status}`,
      );
      return { passed, failed };
    }

    const createdOffer = await createResponse.json();
    createdOfferId = createdOffer.id;
    passed++;
    logTest("Offer creation via API", true, `ID: ${createdOfferId}`);

    // Read-back: Verifica nel DB dopo 500ms
    await new Promise((r) => setTimeout(r, 500));

    const { data: dbOffer, error: dbError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", createdOfferId)
      .single();

    if (dbError || !dbOffer) {
      failed++;
      logTest(
        "Offer read-back from DB",
        false,
        dbError?.message || "Not found",
      );
      return { passed, failed };
    }

    // Verifica campi chiave
    if (dbOffer.name !== offerData.name) {
      failed++;
      logTest(
        "Offer name consistency",
        false,
        `DB: ${dbOffer.name}, API: ${offerData.name}`,
      );
    } else {
      passed++;
      logTest("Offer name consistency", true);
    }

    if (dbOffer.offer_type !== offerData.offer_type) {
      failed++;
      logTest(
        "Offer type consistency",
        false,
        `DB: ${dbOffer.offer_type}, API: ${offerData.offer_type}`,
      );
    } else {
      passed++;
      logTest("Offer type consistency", true);
    }

    // Update: Modifica offerta
    const updateData = {
      name: `DB Proof Test UPDATED ${Date.now()}`,
      rules_json: { discount_percent: 20 },
    };

    const updateResponse = await fetch(`${API_BASE}/offers/${createdOfferId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authTokens.vendor}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!updateResponse.ok) {
      failed++;
      logTest(
        "Offer update via API",
        false,
        `Status: ${updateResponse.status}`,
      );
    } else {
      passed++;
      logTest("Offer update via API", true);

      // Read-back dopo update
      await new Promise((r) => setTimeout(r, 500));

      const { data: updatedOffer } = await supabase
        .from("offers")
        .select("name")
        .eq("id", createdOfferId)
        .single();

      if (updatedOffer && updatedOffer.name === updateData.name) {
        passed++;
        logTest("Offer update consistency", true);
      } else {
        failed++;
        logTest(
          "Offer update consistency",
          false,
          `DB: ${updatedOffer?.name}, Expected: ${updateData.name}`,
        );
      }
    }
  } catch (error) {
    failed++;
    logTest("Offer write-read", false, error.message);
  } finally {
    // Cleanup
    if (createdOfferId && supabase) {
      await supabase.from("offers").delete().eq("id", createdOfferId);
    }
  }

  console.log(`\n📊 Offer Write-Read: ${passed} passati, ${failed} falliti\n`);
  return { passed, failed };
}

async function testSettingsWriteReadBack() {
  console.log("\n📋 TEST 2: Settings - Write + Read-Back dal DB\n");

  if (!authTokens.vendor || !supabase) {
    logTest("Settings write-read", false, "Token o Supabase non disponibile");
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;
  let originalLegalName = null;
  let orgId = null;

  try {
    // Ottieni org ID
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authTokens.vendor}` },
    });
    const me = await meResponse.json();
    orgId = me.organization?.id || me.organizationId;

    if (!orgId) {
      logTest("Settings write-read", false, "Org ID non disponibile");
      return { passed: 0, failed: 1 };
    }

    // Leggi valore originale
    const { data: originalOrg } = await supabase
      .from("organizations")
      .select("legal_name")
      .eq("id", orgId)
      .single();

    originalLegalName = originalOrg?.legal_name;

    // Write: Modifica settings
    const newLegalName = `DB Proof Test ${Date.now()}`;
    const updateResponse = await fetch(
      `${API_BASE}/settings/organization/general?orgId=${orgId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authTokens.vendor}`,
        },
        body: JSON.stringify({ legal_name: newLegalName }),
      },
    );

    if (!updateResponse.ok) {
      failed++;
      logTest(
        "Settings update via API",
        false,
        `Status: ${updateResponse.status}`,
      );
      return { passed, failed };
    }

    passed++;
    logTest("Settings update via API", true);

    // Read-back: Verifica nel DB
    await new Promise((r) => setTimeout(r, 500));

    const { data: updatedOrg } = await supabase
      .from("organizations")
      .select("legal_name")
      .eq("id", orgId)
      .single();

    if (!updatedOrg) {
      failed++;
      logTest("Settings read-back from DB", false, "Organization not found");
    } else if (updatedOrg.legal_name === newLegalName) {
      passed++;
      logTest(
        "Settings read-back consistency",
        true,
        `DB: ${updatedOrg.legal_name}`,
      );
    } else {
      failed++;
      logTest(
        "Settings read-back consistency",
        false,
        `DB: ${updatedOrg.legal_name}, Expected: ${newLegalName}`,
      );
    }
  } catch (error) {
    failed++;
    logTest("Settings write-read", false, error.message);
  } finally {
    // Ripristina valore originale
    if (orgId && originalLegalName && supabase) {
      await supabase
        .from("organizations")
        .update({ legal_name: originalLegalName })
        .eq("id", orgId);
    }
  }

  console.log(
    `\n📊 Settings Write-Read: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function testCatalogToggleWriteReadBack() {
  console.log("\n📋 TEST 3: Catalog Toggle - Write + Read-Back dal DB\n");

  if (!authTokens.vendor || !supabase) {
    logTest(
      "Catalog toggle write-read",
      false,
      "Token o Supabase non disponibile",
    );
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;
  let testInventory = null;
  let testCatalogItem = null;

  try {
    // Setup: Crea dati di test
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authTokens.vendor}` },
    });
    const me = await meResponse.json();
    const orgId = me.organization?.id || me.organizationId;

    if (!orgId) {
      logTest("Catalog toggle write-read", false, "Org ID non disponibile");
      return { passed: 0, failed: 1 };
    }

    // Crea prodotto e inventario
    const product = await factory.createProduct();
    testInventory = await factory.createInventory(orgId, product.id, {
      qty_on_hand: 100,
    });
    testCatalogItem = await factory.createVendorCatalogItem(
      orgId,
      testInventory.sku_id,
      {
        is_for_sale: true,
      },
    );

    const originalIsForSale = testCatalogItem.is_for_sale;
    const newIsForSale = false;

    // Write: Toggle via API
    const toggleResponse = await fetch(
      `${API_BASE}/catalog/vendor/${orgId}/toggle`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authTokens.vendor}`,
        },
        body: JSON.stringify({
          skuId: testInventory.sku_id,
          isForSale: newIsForSale,
        }),
      },
    );

    if (!toggleResponse.ok) {
      failed++;
      logTest(
        "Catalog toggle via API",
        false,
        `Status: ${toggleResponse.status}`,
      );
      return { passed, failed };
    }

    passed++;
    logTest("Catalog toggle via API", true);

    // Read-back: Verifica nel DB
    await new Promise((r) => setTimeout(r, 500));

    const { data: updatedItem } = await supabase
      .from("vendor_catalog_items")
      .select("is_for_sale")
      .eq("id", testCatalogItem.id)
      .single();

    if (!updatedItem) {
      failed++;
      logTest("Catalog toggle read-back", false, "Item not found");
    } else if (updatedItem.is_for_sale === newIsForSale) {
      passed++;
      logTest(
        "Catalog toggle read-back consistency",
        true,
        `DB: ${updatedItem.is_for_sale}`,
      );
    } else {
      failed++;
      logTest(
        "Catalog toggle read-back consistency",
        false,
        `DB: ${updatedItem.is_for_sale}, Expected: ${newIsForSale}`,
      );
    }
  } catch (error) {
    failed++;
    logTest("Catalog toggle write-read", false, error.message);
  } finally {
    // Cleanup
    await factory.cleanup();
  }

  console.log(
    `\n📊 Catalog Toggle Write-Read: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function runAllTests() {
  console.log("💾 DATABASE PROOF TESTS - Write + Read-Back Verification\n");
  console.log("=".repeat(70));

  authTokens.vendor = await login("vendor");

  if (!authTokens.vendor) {
    console.error("❌ Cannot login vendor - aborting tests");
    process.exit(1);
  }

  const offerResults = await testOfferWriteReadBack();
  const settingsResults = await testSettingsWriteReadBack();
  const catalogResults = await testCatalogToggleWriteReadBack();

  const totalPassed =
    offerResults.passed + settingsResults.passed + catalogResults.passed;
  const totalFailed =
    offerResults.failed + settingsResults.failed + catalogResults.failed;

  console.log("=".repeat(70));
  console.log("\n📊 RISULTATI FINALI:\n");
  console.log(`✅ Test passati: ${totalPassed}`);
  console.log(`❌ Test falliti: ${totalFailed}`);
  console.log(
    `📈 Tasso successo: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
  );

  if (totalFailed === 0) {
    console.log("\n🎉 TUTTI I TEST DB PROOF SUPERATI!");
    console.log("✅ Tutti i dati vengono salvati correttamente in Supabase");
    process.exit(0);
  } else {
    console.log("\n⚠️ Alcuni test falliti - deploy bloccato");
    process.exit(1);
  }
}

runAllTests().catch(async (error) => {
  console.error("\n❌ Errore durante i test:", error);
  await factory.cleanup();
  process.exit(1);
});
