import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateDeviceId } from "./device-id";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LicenseFile = {
  customerName: string;
  licenseType: "trial" | "paid";
  deviceId: string;
  expiryDate: string;
};

export function validateLicense() {
  const licensePath = path.join(__dirname, "license.json");

  if (!fs.existsSync(licensePath)) {
    return {
      valid: false,
      reason: "LICENSE_FILE_NOT_FOUND",
    };
  }

  const raw = fs.readFileSync(licensePath, "utf-8");

  const license = JSON.parse(raw) as LicenseFile;

  const currentDeviceId = generateDeviceId();

  if (license.deviceId !== currentDeviceId) {
    return {
      valid: false,
      reason: "DEVICE_ID_MISMATCH",
      expected: license.deviceId,
      current: currentDeviceId,
    };
  }

  const today = new Date();

  const expiry = new Date(`${license.expiryDate}T23:59:59`);

  if (Number.isNaN(expiry.getTime())) {
    return {
      valid: false,
      reason: "INVALID_EXPIRY_DATE",
    };
  }

  if (today > expiry) {
    return {
      valid: false,
      reason: "LICENSE_EXPIRED",
      expiryDate: license.expiryDate,
    };
  }

  return {
    valid: true,
    reason: "LICENSE_VALID",
    customerName: license.customerName,
    licenseType: license.licenseType,
    expiryDate: license.expiryDate,
    deviceId: license.deviceId,
  };
}
