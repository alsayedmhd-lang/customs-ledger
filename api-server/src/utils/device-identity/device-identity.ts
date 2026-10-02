import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ElectronPathProvider } from "../storage/storage-types";

const DEVICE_IDENTITY_FILE = "device-identity.json";

type StoredDeviceIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

export type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

function getIdentityPath(app: ElectronPathProvider): string {
  const userDataPath = path.resolve(app.getPath("userData"));

  if (!userDataPath || userDataPath === path.parse(userDataPath).root) {
    throw new Error("Invalid Electron userData path");
  }

  return path.join(userDataPath, DEVICE_IDENTITY_FILE);
}

function normalizeStoredIdentity(value: unknown): DeviceIdentity | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Partial<StoredDeviceIdentity>;

  if (
    row.version !== 1 ||
    typeof row.deviceId !== "string" ||
    !/^[0-9a-f]{32}$/i.test(row.deviceId) ||
    typeof row.publicKey !== "string" ||
    !row.publicKey.trim() ||
    typeof row.privateKey !== "string" ||
    !row.privateKey.trim() ||
    typeof row.createdAt !== "string" ||
    Number.isNaN(Date.parse(row.createdAt))
  ) {
    return null;
  }

  return {
    deviceId: row.deviceId.toUpperCase(),
    publicKey: row.publicKey,
    privateKey: row.privateKey,
    createdAt: row.createdAt,
  };
}

async function readIdentity(filePath: string): Promise<DeviceIdentity | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeStoredIdentity(JSON.parse(raw));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") return null;

    throw new Error("Device identity file could not be read");
  }
}

async function createIdentity(filePath: string): Promise<DeviceIdentity> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const stored: StoredDeviceIdentity = {
    version: 1,
    deviceId: crypto.randomBytes(16).toString("hex").toUpperCase(),
    publicKey: publicKey
      .export({
        type: "spki",
        format: "pem",
      })
      .toString(),
    privateKey: privateKey
      .export({
        type: "pkcs8",
        format: "pem",
      })
      .toString(),
    createdAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;

  try {
    await fs.writeFile(
      tempPath,
      JSON.stringify(stored, null, 2),
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

  return {
    deviceId: stored.deviceId,
    publicKey: stored.publicKey,
    privateKey: stored.privateKey,
    createdAt: stored.createdAt,
  };
}

export async function getDeviceIdentity(
  app: ElectronPathProvider
): Promise<DeviceIdentity> {
  const filePath = getIdentityPath(app);

  const existing = await readIdentity(filePath);

  if (existing) {
    return existing;
  }

  return createIdentity(filePath);
}

export async function getDeviceIdentityPath(
  app: ElectronPathProvider
): Promise<string> {
  return getIdentityPath(app);
}

export function signDevicePayload(
  identity: DeviceIdentity,
  payload: string
): string {
  const privateKey = crypto.createPrivateKey(identity.privateKey);

  return crypto
    .sign(null, Buffer.from(payload, "utf8"), privateKey)
    .toString("base64");
}

export function verifyDevicePayload(
  publicKey: string,
  payload: string,
  signature: string
): boolean {
  try {
    const key = crypto.createPublicKey(publicKey);

    return crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      key,
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}
