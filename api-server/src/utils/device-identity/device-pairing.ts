import crypto from "node:crypto";

import type { ElectronPathProvider } from "../storage/storage-types";
import { PairingSessionStore } from "./pairing-sessions";
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

/**
 * Public-key fingerprint for explicit, out-of-band pairing approval.
 * Never includes or exposes the device private key.
 */
export function getPairingFingerprint(publicKey: string): string {
  const normalized = normalizePublicKey(publicKey);

  if (!normalized) {
    throw new Error("Invalid pairing public key");
  }

  const der = crypto
    .createPublicKey(normalized)
    .export({ type: "spki", format: "der" });

  const hex = crypto
    .createHash("sha256")
    .update(der)
    .digest("hex")
    .toUpperCase();

  return hex.match(/.{1,4}/g)!.join("-");
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


/**
 * Complete a locally approved pairing using a single-use challenge.
 *
 * Approval must originate from the local application after the user
 * compares the public-key fingerprint through an independent channel.
 *
 * Never expose this function directly as an unauthenticated HTTP action.
 */
export async function completeApprovedPairing(
  app: ElectronPathProvider,
  sessions: PairingSessionStore,
  response: PairingResponse,
  proof: DeviceProof,
  approvedFingerprint: string,
  name?: string | null,
  now = new Date()
): Promise<PairingResult> {
  // Consume first, including when subsequent validation fails.
  const pending = sessions.consume(response.pairingId, now);

  if (
    pending.deviceId !== response.deviceId ||
    pending.publicKey !== normalizePublicKey(response.publicKey) ||
    pending.challenge.challengeId !== response.challenge.challengeId ||
    pending.challenge.nonce !== response.challenge.nonce ||
    pending.challenge.issuedAt !== response.challenge.issuedAt ||
    pending.challenge.expiresAt !== response.challenge.expiresAt
  ) {
    throw new Error("Pairing session does not match issued challenge");
  }

  const fingerprint = getPairingFingerprint(pending.publicKey);

  if (
    typeof approvedFingerprint !== "string" ||
    approvedFingerprint.trim().toUpperCase() !== fingerprint
  ) {
    throw new Error("Local pairing fingerprint approval required");
  }

  if (
    !verifyDeviceProof(
      pending.challenge,
      proof,
      pending.deviceId,
      now
    )
  ) {
    throw new Error("Pairing device proof is invalid");
  }

  if (
    normalizePublicKey(proof.publicKey) !== pending.publicKey
  ) {
    throw new Error("Pairing proof public key mismatch");
  }

  const existing = await getTrustedDevice(app, pending.deviceId);

  if (existing && existing.publicKey !== pending.publicKey) {
    throw new Error("Trusted device public key conflict");
  }

  const trustedDevice = await trustDevice(app, {
    deviceId: pending.deviceId,
    publicKey: pending.publicKey,
    name: name ?? null,
  });

  return {
    trustedDevice,
    pairingId: pending.pairingId,
  };
}
