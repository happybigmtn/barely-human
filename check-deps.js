import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const installedDeps = {
  ...packageJson.dependencies || {},
  ...packageJson.devDependencies || {}
};

const requiredDeps = [
  "@nomicfoundation/hardhat-ignition",
  "@nomicfoundation/hardhat-ignition-viem", 
  "@nomicfoundation/hardhat-keystore",
  "@nomicfoundation/hardhat-network-helpers",
  "@nomicfoundation/hardhat-node-test-runner",
  "@nomicfoundation/hardhat-viem",
  "@nomicfoundation/hardhat-viem-assertions",
  "@nomicfoundation/hardhat-verify",
  "@nomicfoundation/ignition-core",
  "chai"
];

console.log("Checking dependencies...\n");
console.log("Installed:");
for (const dep of Object.keys(installedDeps)) {
  console.log(`  ✓ ${dep}: ${installedDeps[dep]}`);
}

console.log("\nRequired but missing:");
const missing = [];
for (const dep of requiredDeps) {
  if (!installedDeps[dep]) {
    console.log(`  ✗ ${dep}`);
    missing.push(dep);
  }
}

if (missing.length > 0) {
  console.log("\nInstall command:");
  console.log(`npm install --save-dev ${missing.join(' ')}`);
} else {
  console.log("\nAll required dependencies are installed!");
}