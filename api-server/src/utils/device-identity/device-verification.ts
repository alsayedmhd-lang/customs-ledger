import crypto from "node:crypto";

import type { DeviceIdentity } from "./device-identity";

const CHALLENGE_BYTES = 32;
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

export type DeviceChallenge = {
  challengeId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export type DeviceProof = {
  deviceId: string;
  publicKey: string;
  challengeId: string;
  nonce: string;
  issuedAt: string;
  signature: string;
};

export function createDeviceChallenge(
  now = new Date()
): DeviceChallenge {
  const issuedAt = now.getTime();
  const expiresAt = issuedAt + CHALLENGE_MAX_AGE_MS;

  return {
    challengeId: crypto.randomUUID(),
    nonce: crypto.randomBytes(CHALLENGE_BYTES).toString("base64url"),
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function buildChallengePayload(challenge: DeviceChallenge): string {
  return [
    "LEDGER_DEVICE_VERIFICATION_V1",
    challenge.challengeId,
    challenge.nonce,
    challenge.issuedAt,
    challenge.expiresAt,
  ].join("|");
}

export function createDeviceProof(
  identity: DeviceIdentity,
  challenge: DeviceChallenge
): DeviceProof {
  const payload = buildChallengePayload(challenge);

  const privateKey = crypto.createPrivateKey(identity.privateKey);

  const signature = crypto
    .sign(null, Buffer.from(payload, "utf8"), privateKey)
    .toString("base64");

  return {
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    signature,
  };
}

export function verifyDeviceProof(
  challenge: DeviceChallenge,
  proof: DeviceProof,
  expectedDeviceId?: string,
  now = new Date()
): boolean {
  if (!proof || typeof proof !== "object") {
    return false;
  }

  if (!proof.deviceId || !/^[0-9A-F]{32}$/i.test(proof.deviceId)) {
    return false;
  }

  if (
    expectedDeviceId &&
    proof.deviceId.toUpperCase() !== expectedDeviceId.toUpperCase()
  ) {
    return false;
  }

  if (proof.challengeId !== challenge.challengeId) {
    return false;
  }

  if (proof.nonce !== challenge.nonce) {
    return false;
  }

  if (proof.issuedAt !== challenge.issuedAt) {
    return false;
  }

  if (!proof.signature || !proof.publicKey) {
    return false;
  }

  const issuedAt = Date.parse(challenge.issuedAt);
  const expiresAt = Date.parse(challenge.expiresAt);
  const current = now.getTime();

  if (
    Number.isNaN(issuedAt) ||
    Number.isNaN(expiresAt) ||
    expiresAt < issuedAt ||
    expiresAt - issuedAt > CHALLENGE_MAX_AGE_MS ||
    current < issuedAt ||
    current > expiresAt
  ) {
    return false;
  }

  const payload = buildChallengePayload(challenge);

  try {
    const publicKey = crypto.createPublicKey(proof.publicKey);

    return crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      publicKey,
      Buffer.from(proof.signature, "base64")
    );
  } catch {
    return false;
  }
}
