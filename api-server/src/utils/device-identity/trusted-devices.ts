import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { ElectronPathProvider } from "../storage/storage-types";

const TRUSTED_DEVICES_FILE = "trusted-devices.json";
const TRUSTED_DEVICES_VERSION = 1;

export type TrustedDevice = {
  deviceId: string;
  publicKey: string;
  name: string | null;
  trustedAt: string;
  revokedAt: string | null;
};

type StoredTrustedDevices = {
  version: typeof TRUSTED_DEVICES_VERSION;
  devices: TrustedDevice[];
};

function getTrustStorePath(app: ElectronPathProvider): string {
  const userDataPath = path.resolve(app.getPath("userData"));

  if (!userDataPath || userDataPath === path.parse(userDataPath).root) {
    throw new Error("Invalid Electron userData path");
  }

  return path.join(userDataPath, TRUSTED_DEVICES_FILE);
}

function normalizeDeviceId(value: unknown): string | null {
  const id = String(value ?? "").trim().toUpperCase();

  return /^[0-9A-F]{32}$/.test(id) ? id : null;
}

function normalizePublicKey(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const key = crypto.createPublicKey(value);

    if (key.asymmetricKeyType !== "ed25519") {
      return null;
    }

    return key
      .export({
        type: "spki",
        format: "pem",
      })
      .toString();
  } catch {
    return null;
  }
}

function normalizeTrustedDevice(value: unknown): TrustedDevice | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Partial<TrustedDevice>;

  const deviceId = normalizeDeviceId(row.deviceId);
  const publicKey = normalizePublicKey(row.publicKey);

  if (!deviceId || !publicKey) {
    return null;
  }

  if (
    typeof row.trustedAt !== "string" ||
    Number.isNaN(Date.parse(row.trustedAt))
  ) {
    return null;
  }

  if (
    row.revokedAt !== null &&
    row.revokedAt !== undefined &&
    (
      typeof row.revokedAt !== "string" ||
      Number.isNaN(Date.parse(row.revokedAt))
    )
  ) {
    return null;
  }

  return {
    deviceId,
    publicKey,
    name:
      typeof row.name === "string" && row.name.trim()
        ? row.name.trim()
        : null,
    trustedAt: row.trustedAt,
    revokedAt: row.revokedAt ?? null,
  };
}

async function readTrustStore(
  filePath: string
): Promise<TrustedDevice[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredTrustedDevices>;

    if (
      parsed.version !== TRUSTED_DEVICES_VERSION ||
      !Array.isArray(parsed.devices)
    ) {
      throw new Error("Trusted devices file has an invalid format");
    }

    const devices: TrustedDevice[] = [];

    for (const value of parsed.devices) {
      const device = normalizeTrustedDevice(value);

      if (!device) {
        throw new Error("Trusted devices file contains invalid device data");
      }

      if (devices.some((item) => item.deviceId === device.deviceId)) {
        throw new Error("Trusted devices file contains duplicate device IDs");
      }

      devices.push(device);
    }

    return devices;
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return [];
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Trusted devices file could not be read");
  }
}

async function writeTrustStore(
  filePath: string,
  devices: TrustedDevice[]
): Promise<void> {
  const payload: StoredTrustedDevices = {
    version: TRUSTED_DEVICES_VERSION,
    devices,
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath =
    `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;

  try {
    await fs.writeFile(
      tempPath,
      JSON.stringify(payload, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      }
    );

    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function listTrustedDevices(
  app: ElectronPathProvider
): Promise<TrustedDevice[]> {
  const filePath = getTrustStorePath(app);

  return readTrustStore(filePath);
}

export async function getTrustedDevice(
  app: ElectronPathProvider,
  deviceId: string
): Promise<TrustedDevice | null> {
  const normalizedId = normalizeDeviceId(deviceId);

  if (!normalizedId) {
    throw new Error("Invalid trusted device ID");
  }

  const devices = await listTrustedDevices(app);

  return (
    devices.find((device) => device.deviceId === normalizedId) ??
    null
  );
}

export async function trustDevice(
  app: ElectronPathProvider,
  input: {
    deviceId: string;
    publicKey: string;
    name?: string | null;
  }
): Promise<TrustedDevice> {
  const deviceId = normalizeDeviceId(input.deviceId);
  const publicKey = normalizePublicKey(input.publicKey);

  if (!deviceId) {
    throw new Error("Invalid trusted device ID");
  }

  if (!publicKey) {
    throw new Error("Invalid trusted device public key");
  }

  const filePath = getTrustStorePath(app);
  const devices = await readTrustStore(filePath);

  const existing = devices.find(
    (device) => device.deviceId === deviceId
  );

  if (existing) {
    if (existing.publicKey !== publicKey) {
      throw new Error(
        "Trusted device public key conflict"
      );
    }

    if (!existing.revokedAt) {
      return existing;
    }

    existing.revokedAt = null;

    if (input.name !== undefined) {
      existing.name =
        typeof input.name === "string" && input.name.trim()
          ? input.name.trim()
          : null;
    }

    await writeTrustStore(filePath, devices);

    return existing;
  }

  const device: TrustedDevice = {
    deviceId,
    publicKey,
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : null,
    trustedAt: new Date().toISOString(),
    revokedAt: null,
  };

  devices.push(device);

  await writeTrustStore(filePath, devices);

  return device;
}

export async function revokeTrustedDevice(
  app: ElectronPathProvider,
  deviceId: string
): Promise<boolean> {
  const normalizedId = normalizeDeviceId(deviceId);

  if (!normalizedId) {
    throw new Error("Invalid trusted device ID");
  }

  const filePath = getTrustStorePath(app);
  const devices = await readTrustStore(filePath);

  const device = devices.find(
    (item) => item.deviceId === normalizedId
  );

  if (!device || device.revokedAt) {
    return false;
  }

  device.revokedAt = new Date().toISOString();

  await writeTrustStore(filePath, devices);

  return true;
}

export async function isTrustedDevice(
  app: ElectronPathProvider,
  deviceId: string
): Promise<boolean> {
  const device = await getTrustedDevice(app, deviceId);

  return Boolean(device && !device.revokedAt);
}

export async function getTrustedDevicesPath(
  app: ElectronPathProvider
): Promise<string> {
  return getTrustStorePath(app);
}
