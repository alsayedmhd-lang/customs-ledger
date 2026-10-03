import { getPairingFingerprint, createPairingResponse } from "./device-pairing";

export type PairingTransferKind = "request" | "response" | "proof";
export type PairingTransfer = {
  format: "ledger-device-pairing";
  version: 1;
  kind: PairingTransferKind;
  payload: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pairing file");
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error("Unexpected pairing file fields");
  }
}
function text(value: unknown, max = 4096): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid pairing file field");
  return value;
}
function date(value: unknown): number {
  const parsed = Date.parse(text(value, 40));
  if (!Number.isFinite(parsed)) throw new Error("Invalid pairing date");
  return parsed;
}
function uuid(value: unknown) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value, 36))) throw new Error("Invalid pairing identifier");
}
function windowDates(issued: unknown, expires: unknown, now: Date) {
  const start = date(issued), end = date(expires), current = now.getTime();
  if (end <= start || end - start > 300000 || current < start || current > end) throw new Error("Pairing file expired");
}

/** Strict allowlist: public protocol fields only, never private keys or database credentials. */
export function validatePairingTransfer(value: unknown, now = new Date()): PairingTransfer {
  const file = record(value);
  exactKeys(file, ["format", "version", "kind", "payload"]);
  if (file.format !== "ledger-device-pairing" || file.version !== 1 || !["request", "response", "proof"].includes(String(file.kind))) {
    throw new Error("Unsupported Ledger pairing file");
  }
  const payload = record(file.payload);
  const kind = file.kind as PairingTransferKind;
  exactKeys(payload, kind === "request"
    ? ["pairingId", "deviceId", "publicKey", "createdAt", "expiresAt"]
    : kind === "response"
      ? ["pairingId", "deviceId", "publicKey", "challenge"]
      : ["deviceId", "publicKey", "challengeId", "nonce", "issuedAt", "signature"]);
  if (!/^[0-9A-F]{32}$/.test(text(payload.deviceId, 32))) throw new Error("Invalid pairing device ID");
  getPairingFingerprint(text(payload.publicKey));
  if (kind === "request") {
    uuid(payload.pairingId);
    createPairingResponse(payload as Parameters<typeof createPairingResponse>[0], now);
  } else if (kind === "response") {
    uuid(payload.pairingId);
    const challenge = record(payload.challenge);
    exactKeys(challenge, ["challengeId", "nonce", "issuedAt", "expiresAt"]);
    uuid(challenge.challengeId);
    if (!/^[A-Za-z0-9_-]{43}$/.test(text(challenge.nonce, 43))) throw new Error("Invalid pairing nonce");
    windowDates(challenge.issuedAt, challenge.expiresAt, now);
  } else {
    uuid(payload.challengeId);
    if (!/^[A-Za-z0-9_-]{43}$/.test(text(payload.nonce, 43)) || !/^[A-Za-z0-9+/]{86}==$/.test(text(payload.signature, 88))) throw new Error("Invalid pairing proof");
    const issued = date(payload.issuedAt);
    if (now.getTime() < issued || now.getTime() - issued > 300000) throw new Error("Pairing file expired");
  }
  return file as PairingTransfer;
}
