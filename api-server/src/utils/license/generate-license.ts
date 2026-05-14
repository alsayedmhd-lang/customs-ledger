import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customerName = process.argv[2];
const deviceId = process.argv[3];
const expiryDate = process.argv[4];
const licenseType = process.argv[5] || "trial";

if (!customerName || !deviceId || !expiryDate) {
  console.error("");
  console.error("Usage:");
  console.error('pnpm.cmd --dir api-server exec tsx src/utils/license/generate-license.ts "Customer Name" DEVICE_ID YYYY-MM-DD');
  console.error("");
  process.exit(1);
}

const license = {
  customerName,
  licenseType,
  deviceId,
  expiryDate,
  issuedAt: new Date().toISOString(),
};

const outputPath = path.join(__dirname, "generated-license.json");

fs.writeFileSync(outputPath, JSON.stringify(license, null, 2), "utf-8");

console.log("");
console.log("License generated successfully:");
console.log(outputPath);
console.log("");
console.log(JSON.stringify(license, null, 2));
console.log("");
