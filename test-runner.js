import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("Running tests for RK Electronics Backend...");

// Run Jest tests
try {
  execSync("npm test", { stdio: "inherit" });
  console.log("All tests passed successfully!");
} catch (error) {
  console.error("Tests failed:", error.message);
  process.exit(1);
}

// Run specific home tests
try {
  console.log("\nRunning home controller tests...");
  execSync("npm test -- --testNamePattern=Home", { stdio: "inherit" });
  console.log("Home controller tests passed successfully!");
} catch (error) {
  console.error("Home controller tests failed:", error.message);
  process.exit(1);
}

console.log("\nTest execution completed!");