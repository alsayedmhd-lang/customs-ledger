import os from "node:os";
import crypto from "node:crypto";

export function generateDeviceId() {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  const cpuInfo = os.cpus()?.[0]?.model || "unknown-cpu";

  const raw = [
    hostname,
    platform,
    arch,
    cpuInfo,
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();
}
