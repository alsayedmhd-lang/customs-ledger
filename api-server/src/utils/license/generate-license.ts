import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customerName = process.argv[2];
const deviceId = process.argv[3];
const expiryDate = process.argv[4];
const licenseType = process.argv[5] || "trial";
const productSerial = process.argv[6] || "";
const LICENSE_SECRET = "customs-ledger-sqlite-offline-license-v2-2026";

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
  productSerial,
  issuedAt: new Date().toISOString(),
};

const signaturePayload = [
  license.customerName,
  license.deviceId,
  license.expiryDate,
  license.productSerial,
  LICENSE_SECRET,
]
  .map((value) => String(value ?? ""))
  .join("|");

const signedLicense = {
  ...license,
  signature: crypto.createHash("sha256").update(signaturePayload).digest("hex"),
};

const outputPath = path.join(__dirname, "generated-license.json");

fs.writeFileSync(outputPath, JSON.stringify(signedLicense, null, 2), "utf-8");

console.log("");
console.log("License generated successfully:");
console.log(outputPath);
console.log("");
console.log(JSON.stringify(signedLicense, null, 2));
console.log("");
