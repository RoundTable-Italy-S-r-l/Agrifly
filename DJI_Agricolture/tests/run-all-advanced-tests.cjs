#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Eseguendo tutti i test avanzati...\n");
console.log("=".repeat(70));

const tests = [
  { name: "API Contract Tests", file: "api-contract-tests.cjs" },
  { name: "Concurrency Tests", file: "concurrency-tests.cjs" },
  { name: "RLS & Multi-Tenant Tests", file: "rls-multitenant-tests.cjs" },
];

const results = [];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n📋 Eseguendo: ${test.name}\n`);

    const testPath = path.join(__dirname, test.file);
    const proc = spawn("node", [testPath], {
      stdio: "inherit",
      cwd: __dirname,
    });

    proc.on("close", (code) => {
      results.push({ name: test.name, passed: code === 0 });
      resolve(code === 0);
    });

    proc.on("error", (error) => {
      console.error(`❌ Errore eseguendo ${test.name}:`, error);
      results.push({ name: test.name, passed: false });
      resolve(false);
    });
  });
}

async function runAll() {
  for (const test of tests) {
    await runTest(test);
    console.log("\n" + "-".repeat(70));
  }

  console.log("\n" + "=".repeat(70));
  console.log("\n📊 RIEPILOGO FINALE:\n");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
  });

  console.log(`\n✅ Test passati: ${passed}/${results.length}`);
  console.log(`❌ Test falliti: ${failed}/${results.length}`);
  console.log(
    `📈 Tasso successo: ${((passed / results.length) * 100).toFixed(1)}%`,
  );

  if (failed === 0) {
    console.log("\n🎉 TUTTI I TEST AVANZATI SUPERATI!");
    process.exit(0);
  } else {
    console.log("\n⚠️ Alcuni test falliti");
    process.exit(1);
  }
}

runAll();
