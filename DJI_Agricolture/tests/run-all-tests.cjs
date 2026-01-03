#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Eseguendo TUTTI i test avanzati...\n");
console.log("=".repeat(70));

const tests = [
  {
    name: "1. API Contract Tests",
    file: "api-contract-tests.cjs",
    critical: true,
  },
  {
    name: "2. Database Proof Tests (Write + Read-Back)",
    file: "db-proof-complete.cjs",
    critical: true,
  },
  {
    name: "3. Concurrency Tests",
    file: "concurrency-tests.cjs",
    critical: false,
  },
  {
    name: "4. RLS & Multi-Tenant Tests",
    file: "rls-multitenant-tests.cjs",
    critical: true,
  },
];

const results = [];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n📋 ${test.name}\n`);

    const testPath = path.join(__dirname, test.file);
    const proc = spawn("node", [testPath], {
      stdio: "inherit",
      cwd: __dirname,
    });

    proc.on("close", (code) => {
      const passed = code === 0;
      results.push({ ...test, passed });
      resolve(passed);
    });

    proc.on("error", (error) => {
      console.error(`❌ Errore eseguendo ${test.name}:`, error);
      results.push({ ...test, passed: false });
      resolve(false);
    });
  });
}

async function runAll() {
  let criticalFailed = false;

  for (const test of tests) {
    const passed = await runTest(test);
    console.log("\n" + "-".repeat(70));

    if (!passed && test.critical) {
      criticalFailed = true;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("\n📊 RIEPILOGO FINALE:\n");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const criticalPassed = results.filter((r) => r.passed && r.critical).length;
  const criticalTotal = results.filter((r) => r.critical).length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    const critical = result.critical ? " [CRITICO]" : "";
    console.log(`${icon} ${result.name}${critical}`);
  });

  console.log(`\n✅ Test passati: ${passed}/${results.length}`);
  console.log(`❌ Test falliti: ${failed}/${results.length}`);
  console.log(
    `📈 Tasso successo: ${((passed / results.length) * 100).toFixed(1)}%`,
  );
  console.log(`\n🔴 Test critici: ${criticalPassed}/${criticalTotal} passati`);

  if (criticalFailed) {
    console.log("\n❌ DEPLOY BLOCCATO: Test critici falliti!");
    process.exit(1);
  } else if (failed > 0) {
    console.log(
      "\n⚠️  Alcuni test non critici falliti - deploy possibile ma verificare",
    );
    process.exit(0);
  } else {
    console.log("\n🎉 TUTTI I TEST SUPERATI! Deploy consentito.");
    process.exit(0);
  }
}

runAll();
