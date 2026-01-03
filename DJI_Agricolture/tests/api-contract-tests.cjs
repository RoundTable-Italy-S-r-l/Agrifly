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
  buyer: {
    email: "giacomocavalcabo13@gmail.com",
    password: "password",
  },
};

let authTokens = {};
let results = [];

function logTest(name, passed, message = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}${message ? `: ${message}` : ""}`);
  results.push({ name, passed, message });
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

async function testContractViolations() {
  console.log(
    "\n📋 TEST 1: Contract Violations (Body mancante, tipi sbagliati, valori limite)\n",
  );

  const endpoints = [
    {
      name: "POST /auth/login",
      method: "POST",
      path: "/auth/login",
      tests: [
        { body: null, expectedStatus: 400, description: "Body mancante" },
        { body: {}, expectedStatus: 400, description: "Body vuoto" },
        {
          body: { email: "invalid-email", password: "123" },
          expectedStatus: 400,
          description: "Email invalida",
        },
        {
          body: { email: "test@test.com", password: "123" },
          expectedStatus: [400, 401],
          description: "Password troppo corta",
        },
        {
          body: { email: 123, password: "password123" },
          expectedStatus: 400,
          description: "Email non stringa",
        },
        {
          body: { email: "test@test.com", password: 123 },
          expectedStatus: 400,
          description: "Password non stringa",
        },
      ],
    },
    {
      name: "POST /ecommerce/cart/items",
      method: "POST",
      path: "/ecommerce/cart/items",
      tests: [
        { body: null, expectedStatus: 400, description: "Body mancante" },
        { body: {}, expectedStatus: 400, description: "Body vuoto" },
        {
          body: { cartId: "", skuId: "test", quantity: 1 },
          expectedStatus: 400,
          description: "cartId vuoto",
        },
        {
          body: { cartId: "test", skuId: "", quantity: 1 },
          expectedStatus: 400,
          description: "skuId vuoto",
        },
        {
          body: { cartId: "test", skuId: "test", quantity: -1 },
          expectedStatus: 400,
          description: "Quantity negativa",
        },
        {
          body: { cartId: "test", skuId: "test", quantity: 0 },
          expectedStatus: 400,
          description: "Quantity zero",
        },
        {
          body: { cartId: "test", skuId: "test", quantity: "invalid" },
          expectedStatus: 400,
          description: "Quantity non numero",
        },
      ],
    },
    {
      name: "POST /offers",
      method: "POST",
      path: "/offers",
      requiresAuth: true,
      tests: [
        { body: null, expectedStatus: 400, description: "Body mancante" },
        { body: {}, expectedStatus: 400, description: "Body vuoto" },
        {
          body: { offer_type: "INVALID", name: "Test" },
          expectedStatus: 400,
          description: "offer_type invalido",
        },
        {
          body: { offer_type: "PROMO", name: "" },
          expectedStatus: 400,
          description: "Name vuoto",
        },
        {
          body: {
            offer_type: "PROMO",
            name: "Test",
            valid_from: "invalid-date",
          },
          expectedStatus: 400,
          description: "Date invalida",
        },
        {
          body: { offer_type: "PROMO", name: "Test", rules_json: "not-object" },
          expectedStatus: 400,
          description: "rules_json invalido",
        },
      ],
    },
    {
      name: "PUT /catalog/vendor/:orgId/product",
      method: "PUT",
      path: "/catalog/vendor/test-org-id/product",
      requiresAuth: true,
      tests: [
        { body: null, expectedStatus: 400, description: "Body mancante" },
        { body: {}, expectedStatus: 400, description: "Body vuoto" },
        {
          body: { skuId: "" },
          expectedStatus: 400,
          description: "skuId vuoto",
        },
        {
          body: { skuId: "test", price: -1 },
          expectedStatus: 400,
          description: "Price negativo",
        },
        {
          body: { skuId: "test", price: "invalid" },
          expectedStatus: 400,
          description: "Price non numero",
        },
      ],
    },
    {
      name: "POST /orders/create-from-cart",
      method: "POST",
      path: "/orders/create-from-cart",
      requiresAuth: true,
      tests: [
        { body: null, expectedStatus: 400, description: "Body mancante" },
        { body: {}, expectedStatus: 400, description: "Body vuoto" },
        {
          body: { items: "not-array" },
          expectedStatus: 400,
          description: "Items non array",
        },
        {
          body: { items: [] },
          expectedStatus: 400,
          description: "Items vuoto",
        },
        {
          body: { items: [{ skuId: "", quantity: 1 }] },
          expectedStatus: 400,
          description: "skuId vuoto in item",
        },
        {
          body: { items: [{ skuId: "test", quantity: -1 }] },
          expectedStatus: 400,
          description: "Quantity negativa in item",
        },
      ],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    for (const test of endpoint.tests) {
      try {
        const headers = { "Content-Type": "application/json" };
        if (endpoint.requiresAuth && authTokens.vendor) {
          headers["Authorization"] = `Bearer ${authTokens.vendor}`;
        }

        const response = await fetch(`${API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers,
          body: test.body ? JSON.stringify(test.body) : null,
        });

        const expectedStatuses = Array.isArray(test.expectedStatus)
          ? test.expectedStatus
          : [test.expectedStatus];
        const success = expectedStatuses.includes(response.status);
        if (success) {
          passed++;
          logTest(
            `${endpoint.name} - ${test.description}`,
            true,
            `Status: ${response.status}`,
          );
        } else {
          failed++;
          let errorDetails = `Status: ${response.status} (atteso: ${test.expectedStatus})`;
          try {
            const errorBody = await response.text();
            if (errorBody) {
              errorDetails += ` | Response: ${errorBody.substring(0, 200)}`;
            }
          } catch (e) {
            // Ignora errori di parsing
          }
          logTest(
            `${endpoint.name} - ${test.description}`,
            false,
            errorDetails,
          );
          console.log(`   📋 Body inviato:`, JSON.stringify(test.body));
          console.log(`   📋 Endpoint: ${endpoint.method} ${endpoint.path}`);
        }
      } catch (error) {
        failed++;
        logTest(`${endpoint.name} - ${test.description}`, false, error.message);
      }
    }
  }

  console.log(
    `\n📊 Contract Violations: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function testResponseValidation() {
  console.log("\n📋 TEST 2: Response Validation (shape, campi sensibili)\n");

  if (!authTokens.vendor) {
    logTest("Response validation", false, "Token non disponibile");
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;

  // Test login response
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_ACCOUNTS.vendor.email,
        password: TEST_ACCOUNTS.vendor.password,
      }),
    });

    if (response.ok) {
      const data = await response.json();

      // Verifica presenza campi attesi
      const hasToken = !!(data.token || data.accessToken);
      const hasUser = !!data.user;

      // Verifica assenza campi sensibili
      const noPassword =
        !data.password && !data.password_hash && !data.hashedPassword;
      const noSecrets = !data.secret && !data.service_role_key;

      if (hasToken && hasUser && noPassword && noSecrets) {
        passed++;
        logTest(
          "Login response validation",
          true,
          "Shape corretta, nessun campo sensibile",
        );
      } else {
        failed++;
        logTest(
          "Login response validation",
          false,
          `Missing fields or sensitive data: token=${hasToken}, user=${hasUser}, password=${!noPassword}`,
        );
      }
    }
  } catch (error) {
    failed++;
    logTest("Login response validation", false, error.message);
  }

  // Test me response
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authTokens.vendor}` },
    });

    if (response.ok) {
      const data = await response.json();

      // Verifica presenza campi attesi
      const hasId = !!data.id || !!data.user?.id;
      const hasEmail = !!(data.email || data.user?.email);

      // Verifica assenza campi sensibili
      const noPassword =
        !data.password && !data.password_hash && !data.hashedPassword;
      const noToken = !data.token && !data.refreshToken;

      if (hasId && hasEmail && noPassword && noToken) {
        passed++;
        logTest(
          "Me response validation",
          true,
          "Shape corretta, nessun campo sensibile",
        );
      } else {
        failed++;
        logTest(
          "Me response validation",
          false,
          `Issues: id=${hasId}, email=${hasEmail}, password=${!noPassword}`,
        );
      }
    }
  } catch (error) {
    failed++;
    logTest("Me response validation", false, error.message);
  }

  // Test offer creation response
  try {
    const response = await fetch(`${API_BASE}/offers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authTokens.vendor}`,
      },
      body: JSON.stringify({
        offer_type: "PROMO",
        name: `Test Response ${Date.now()}`,
        rules_json: { discount_percent: 10 },
        valid_from: new Date().toISOString(),
        valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "ACTIVE",
      }),
    });

    if (response.ok) {
      const data = await response.json();

      // Verifica presenza campi attesi
      const hasId = !!data.id;
      const hasName = !!data.name;
      const hasType = !!data.offer_type;

      // Verifica assenza campi sensibili
      const noSecrets = !data.service_role_key && !data.internal_id;

      if (hasId && hasName && hasType && noSecrets) {
        passed++;
        logTest(
          "Offer creation response validation",
          true,
          "Shape corretta, nessun campo sensibile",
        );

        // Cleanup
        if (supabase && data.id) {
          await supabase.from("offers").delete().eq("id", data.id);
        }
      } else {
        failed++;
        logTest(
          "Offer creation response validation",
          false,
          `Missing fields or sensitive data`,
        );
      }
    }
  } catch (error) {
    failed++;
    logTest("Offer creation response validation", false, error.message);
  }

  console.log(
    `\n📊 Response Validation: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function testAuthAndPermissions() {
  console.log("\n📋 TEST 3: Auth & Permissions (401, 403, cross-org)\n");

  let passed = 0;
  let failed = 0;

  // Test senza token
  try {
    const response = await fetch(`${API_BASE}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_type: "PROMO", name: "Test" }),
    });
    if (response.status === 401) {
      passed++;
      logTest("POST /offers senza token", true, "401 Unauthorized");
    } else {
      failed++;
      logTest(
        "POST /offers senza token",
        false,
        `Status: ${response.status} (atteso: 401)`,
      );
    }
  } catch (error) {
    failed++;
    logTest("POST /offers senza token", false, error.message);
  }

  // Test token invalido
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: "Bearer invalid-token-12345" },
    });
    if (response.status === 401) {
      passed++;
      logTest("GET /auth/me con token invalido", true, "401 Unauthorized");
    } else {
      failed++;
      logTest(
        "GET /auth/me con token invalido",
        false,
        `Status: ${response.status} (atteso: 401)`,
      );
    }
  } catch (error) {
    failed++;
    logTest("GET /auth/me con token invalido", false, error.message);
  }

  // Test token scaduto (simulato con token vecchio/malformato)
  try {
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid";
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    if (response.status === 401) {
      passed++;
      logTest(
        "GET /auth/me con token scaduto/malformato",
        true,
        "401 Unauthorized",
      );
    } else {
      failed++;
      logTest(
        "GET /auth/me con token scaduto/malformato",
        false,
        `Status: ${response.status} (atteso: 401)`,
      );
    }
  } catch (error) {
    failed++;
    logTest("GET /auth/me con token scaduto/malformato", false, error.message);
  }

  // Test cross-org access (se abbiamo due org diverse)
  if (authTokens.vendor && authTokens.buyer) {
    try {
      // Prova ad accedere a settings di un'altra org
      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authTokens.buyer}` },
      });
      if (meResponse.ok) {
        const buyerData = await meResponse.json();
        const buyerOrgId =
          buyerData.organization?.id || buyerData.organizationId;

        // Prova a modificare settings con token vendor (altra org)
        const settingsResponse = await fetch(
          `${API_BASE}/settings/organization/general?orgId=${buyerOrgId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authTokens.vendor}`,
            },
            body: JSON.stringify({ legal_name: "Hacked" }),
          },
        );

        // Dovrebbe essere 403 o 404
        if (
          settingsResponse.status === 403 ||
          settingsResponse.status === 404
        ) {
          passed++;
          logTest(
            "Cross-org access prevention",
            true,
            `Status: ${settingsResponse.status}`,
          );
        } else {
          failed++;
          logTest(
            "Cross-org access prevention",
            false,
            `Status: ${settingsResponse.status} (atteso: 403 o 404)`,
          );
        }
      }
    } catch (error) {
      failed++;
      logTest("Cross-org access prevention", false, error.message);
    }
  }

  console.log(
    `\n📊 Auth & Permissions: ${passed} passati, ${failed} falliti\n`,
  );
  return { passed, failed };
}

async function runAllTests() {
  console.log("🔍 API CONTRACT TESTS - Validazione Completa\n");
  console.log("=".repeat(70));

  // Login
  authTokens.vendor = await login("vendor");
  authTokens.buyer = await login("buyer");

  const contractResults = await testContractViolations();
  const responseResults = await testResponseValidation();
  const authResults = await testAuthAndPermissions();

  const totalPassed =
    contractResults.passed + responseResults.passed + authResults.passed;
  const totalFailed =
    contractResults.failed + responseResults.failed + authResults.failed;

  console.log("=".repeat(70));
  console.log("\n📊 RISULTATI FINALI:\n");
  console.log(`✅ Test passati: ${totalPassed}`);
  console.log(`❌ Test falliti: ${totalFailed}`);
  console.log(
    `📈 Tasso successo: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
  );

  if (totalFailed === 0) {
    console.log("\n🎉 TUTTI I TEST CONTRACT SUPERATI!");
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
