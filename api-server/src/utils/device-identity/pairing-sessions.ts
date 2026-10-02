import crypto from "node:crypto";

import {
  createDeviceChallenge,
  type DeviceChallenge,
} from "./device-verification";

export type PendingPairingSession = {
  pairingId: string;
  deviceId: string;
  publicKey: string;
  challenge: DeviceChallenge;
};

export class PairingSessionStore {
  private readonly sessions = new Map<string, PendingPairingSession>();

  create(
    pairingId: string,
    deviceId: string,
    publicKey: string,
    now = new Date()
  ): PendingPairingSession {
    if (
      !crypto.randomUUID ||
      typeof pairingId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(pairingId)
    ) {
      throw new Error("Invalid pairing ID");
    }

    if (!/^[0-9a-f]{32}$/i.test(deviceId)) {
      throw new Error("Invalid pairing device ID");
    }

    const key = crypto.createPublicKey(publicKey);

    if (key.asymmetricKeyType !== "ed25519") {
      throw new Error("Invalid pairing public key");
    }

    if (this.sessions.has(pairingId)) {
      throw new Error("Pairing session already exists");
    }

    const session: PendingPairingSession = {
      pairingId,
      deviceId: deviceId.toUpperCase(),
      publicKey: key.export({
        type: "spki",
        format: "pem",
      }).toString(),
      challenge: createDeviceChallenge(now),
    };

    this.sessions.set(pairingId, session);

    return structuredClone(session);
  }

  consume(
    pairingId: string,
    now = new Date()
  ): PendingPairingSession {
    const session = this.sessions.get(pairingId);

    if (!session) {
      throw new Error("Pairing session missing or already consumed");
    }

    // Consume before returning: failed verification cannot reuse it.
    this.sessions.delete(pairingId);

    const issuedAt = Date.parse(session.challenge.issuedAt);
    const expiresAt = Date.parse(session.challenge.expiresAt);
    const current = now.getTime();

    if (
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      current < issuedAt ||
      current > expiresAt
    ) {
      throw new Error("Pairing session expired");
    }

    return structuredClone(session);
  }

  cancel(pairingId: string): boolean {
    return this.sessions.delete(pairingId);
  }
}
