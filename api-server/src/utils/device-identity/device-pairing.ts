import crypto from "node:crypto";

import type { ElectronPathProvider } from "../storage/storage-types";
import {
  getDeviceIdentity,
  type DeviceIdentity,
} from "./device-identity";
import {
  createDeviceChallenge,
  createDeviceProof,
  verifyDeviceProof,
  type DeviceChallenge,
  type DeviceProof,
} from "./device-verification";
import {
  getTrustedDevice,
  trustDevice,
  type TrustedDevice,
} from "./trusted-devices";

const PAIRING_MAX_AGE_MS = 5 * 60 * 1000;

export type PairingRequest = {
  pairingId: string;
  deviceId: string;
  publicKey: string;
  createdAt: string;
  expiresAt: string;
};

export type PairingResponse = {
  pairingId: string;
  deviceId: string;
  publicKey: string;
  challenge: DeviceChallenge;
};

export type PairingResult = {
  trustedDevice: TrustedDevice;
  pairingId: string;
};

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

function createPairingId(): string {
  return crypto.randomUUID();
}

function createPairingRequestFromIdentity(
  identity: DeviceIdentity,
  now: Date
): PairingRequest {
  const createdAt = now.getTime();
  const expiresAt = createdAt + PAIRING_MAX_AGE_MS;

  return {
    pairingId: createPairingId(),
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function createPairingRequest(
  app: ElectronPathProvider,
  now = new Date()
): Promise<PairingRequest> {
  const identity = await getDeviceIdentity(app);

  return createPairingRequestFromIdentity(identity, now);
}

export function createPairingResponse(
  request: PairingRequest,
  now = new Date()
): PairingResponse {
  const deviceId = normalizeDeviceId(request.deviceId);
  const publicKey = normalizePublicKey(request.publicKey);

  if (!deviceId) {
    throw new Error("Invalid pairing device ID");
  }

  if (!publicKey) {
    throw new Error("Invalid pairing public key");
  }

  if (
    typeof request.pairingId !== "string" ||
    !request.pairingId.trim()
  ) {
    throw new Error("Invalid pairing ID");
  }

  const createdAt = Date.parse(request.createdAt);
  const expiresAt = Date.parse(request.expiresAt);
  const current = now.getTime();

  if (
    Number.isNaN(createdAt) ||
    Number.isNaN(expiresAt) ||
    expiresAt < createdAt ||
    expiresAt - createdAt > PAIRING_MAX_AGE_MS ||
    current < createdAt ||
    current > expiresAt
  ) {
    throw new Error("Pairing request expired");
  }

  const challenge = createDeviceChallenge(now);

  return {
    pairingId: request.pairingId,
    deviceId,
    publicKey,
    challenge,
  };
}

export async function completePairing(
  app: ElectronPathProvider,
  response: PairingResponse,
  proof: DeviceProof,
  name?: string | null,
  now = new Date()
): Promise<PairingResult> {
  if (!response || typeof response !== "object") {
    throw new Error("Invalid pairing response");
  }

  if (
    typeof response.pairingId !== "string" ||
    !response.pairingId.trim()
  ) {
    throw new Error("Invalid pairing ID");
  }

  const deviceId = normalizeDeviceId(response.deviceId);
  const publicKey = normalizePublicKey(response.publicKey);

  if (!deviceId) {
    throw new Error("Invalid pairing device ID");
  }

  if (!publicKey) {
    throw new Error("Invalid pairing public key");
  }

  if (proof.deviceId.toUpperCase() !== deviceId) {
    throw new Error("Pairing device ID mismatch");
  }

  const proofPublicKey = normalizePublicKey(proof.publicKey);

  if (!proofPublicKey || proofPublicKey !== publicKey) {
    throw new Error("Pairing public key mismatch");
  }

  if (proof.challengeId !== response.challenge.challengeId) {
    throw new Error("Pairing challenge mismatch");
  }

  if (
    !verifyDeviceProof(
      response.challenge,
      proof,
      deviceId,
      now
    )
  ) {
    throw new Error("Pairing device proof is invalid");
  }

  const existing = await getTrustedDevice(app, deviceId);

  if (existing && existing.publicKey !== publicKey) {
    throw new Error("Trusted device public key conflict");
  }

  const trustedDevice = await trustDevice(app, {
    deviceId,
    publicKey,
    name: name ?? null,
  });

  return {
    trustedDevice,
    pairingId: response.pairingId,
  };
}

export async function createSignedPairingProof(
  app: ElectronPathProvider,
  response: PairingResponse
): Promise<DeviceProof> {
  const identity = await getDeviceIdentity(app);

  if (identity.deviceId !== response.deviceId) {
    throw new Error("Local device does not match pairing device");
  }

  if (identity.publicKey !== response.publicKey) {
    throw new Error("Local device public key does not match pairing request");
  }

  return createDeviceProof(
    identity,
    response.challenge
  );
}
