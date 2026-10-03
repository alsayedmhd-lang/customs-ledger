import crypto from "node:crypto";
import { getDeviceIdentity, type DeviceIdentity } from "./device-identity";
import { getPairingFingerprint } from "./device-pairing";
import { getTrustedDevice, trustDevice } from "./trusted-devices";
import type { ElectronPathProvider } from "../storage/storage-types";

type Request = { pairingId: string; deviceId: string; publicKey: string; createdAt: string; expiresAt: string; nonce: string };
type Response = { request: Request; deviceId: string; publicKey: string; nonce: string; signature: string };
type Proof = { response: Response; signature: string };
type Confirmation = { proof: Proof; signature: string };
export type MutualKind = "request" | "response" | "proof" | "confirmation";
export type MutualTransfer = { format: "ledger-device-pairing"; version: 2; kind: MutualKind; payload: Request | Response | Proof | Confirmation };
function canonical(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function bytes(stage: string, value: unknown) { return Buffer.from(`LEDGER_MUTUAL_PAIRING_V2|${stage}|${canonical(value)}`); }
function sign(identity: DeviceIdentity, stage: string, value: unknown) { return crypto.sign(null, bytes(stage, value), identity.privateKey).toString("base64"); }
function verify(key: string, stage: string, value: unknown, signature: string) {
  if (!crypto.verify(null, bytes(stage, value), key, Buffer.from(signature, "base64"))) throw Error("Invalid mutual pairing signature");
}
function fields(value: any, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw Error("Unexpected mutual pairing fields");
}
function identity(value: any) {
  if (typeof value.deviceId !== "string" || !/^[0-9A-F]{32}$/.test(value.deviceId) || typeof value.publicKey !== "string" || value.publicKey.length > 4096) throw Error("Invalid pairing identity");
  getPairingFingerprint(value.publicKey);
}
function nonce(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw Error("Invalid pairing nonce"); }
function signature(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(value)) throw Error("Invalid pairing signature"); }
function request(value: any, now: Date) {
  fields(value, ["pairingId", "deviceId", "publicKey", "createdAt", "expiresAt", "nonce"]); identity(value); nonce(value.nonce);
  if (typeof value.pairingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.pairingId)) throw Error("Invalid pairing ID");
  if (typeof value.createdAt !== "string" || typeof value.expiresAt !== "string") throw Error("Invalid pairing dates");
  const start = Date.parse(value.createdAt), end = Date.parse(value.expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end-start > 300000 || now.getTime() < start || now.getTime() > end) throw Error("Pairing file expired");
}
function response(value: any, now: Date) {
  fields(value, ["request", "deviceId", "publicKey", "nonce", "signature"]); request(value.request, now); identity(value); nonce(value.nonce); signature(value.signature);
  if (value.deviceId === value.request.deviceId) throw Error("Cannot pair a device with itself");
  const { signature: sig, ...body } = value; verify(value.publicKey, "response", body, sig);
}
function proof(value: any, now: Date) {
  fields(value, ["response", "signature"]); response(value.response, now); signature(value.signature);
  verify(value.response.request.publicKey, "proof", value.response, value.signature);
}
export function validateMutualTransfer(value: any, now = new Date()): MutualTransfer {
  fields(value, ["format", "version", "kind", "payload"]);
  if (value.format !== "ledger-device-pairing" || value.version !== 2) throw Error("Mutual pairing requires the updated Ledger version on both devices");
  switch (value.kind) {
    case "request": request(value.payload, now); break;
    case "response": response(value.payload, now); break;
    case "proof": proof(value.payload, now); break;
    case "confirmation":
      fields(value.payload, ["proof", "signature"]); proof(value.payload.proof, now); signature(value.payload.signature);
      verify(value.payload.proof.response.publicKey, "confirmation", value.payload.proof, value.payload.signature); break;
    default: throw Error("Unsupported mutual pairing file");
  }
  return value;
}
function equal(a: unknown, b: unknown) { if (canonical(a) !== canonical(b)) throw Error("Pairing file does not match the local session"); }
function approval(key: string, fingerprint: string) {
  if (typeof fingerprint !== "string" || fingerprint.trim().toUpperCase() !== getPairingFingerprint(key)) throw Error("Local fingerprint approval required");
}
export class MutualPairingStore {
  private requests = new Map<string, Request>();
  private responses = new Map<string, Response>();
  private proofs = new Map<string, { proof: Proof; name: string | null }>();
  private prune(now: Date) {
    for (const [id, r] of this.requests) if (Date.parse(r.expiresAt) < now.getTime()) this.requests.delete(id);
    for (const [id, r] of this.responses) if (Date.parse(r.request.expiresAt) < now.getTime()) this.responses.delete(id);
    for (const [id, p] of this.proofs) if (Date.parse(p.proof.response.request.expiresAt) < now.getTime()) this.proofs.delete(id);
  }
  async create(app: ElectronPathProvider, now = new Date()): Promise<Request> {
    this.prune(now); const local = await getDeviceIdentity(app);
    const value = { pairingId: crypto.randomUUID(), deviceId: local.deviceId, publicKey: local.publicKey, createdAt: now.toISOString(), expiresAt: new Date(now.getTime()+300000).toISOString(), nonce: crypto.randomBytes(32).toString("base64url") };
    this.requests.clear(); this.proofs.clear(); this.requests.set(value.pairingId, value); return structuredClone(value);
  }
  async receive(app: ElectronPathProvider, value: Request, now = new Date()): Promise<Response> {
    this.prune(now); request(value, now); const local = await getDeviceIdentity(app);
    if (local.deviceId === value.deviceId || this.responses.has(value.pairingId)) throw Error("Invalid or duplicate pairing request");
    const body = { request: structuredClone(value), deviceId: local.deviceId, publicKey: local.publicKey, nonce: crypto.randomBytes(32).toString("base64url") };
    const result = { ...body, signature: sign(local, "response", body) };
    if (this.responses.size >= 32) throw Error("Too many pending pairing requests");
    this.responses.set(value.pairingId, result); return structuredClone(result);
  }
  async prove(app: ElectronPathProvider, value: Response, fingerprint: string, name: string | null, now = new Date()): Promise<Proof> {
    this.prune(now); response(value, now); const id = value.request.pairingId;
    const pending = this.requests.get(id); if (!pending) throw Error("Pairing request missing or already used");
    equal(pending, value.request); approval(value.publicKey, fingerprint);
    const local = await getDeviceIdentity(app); equal(local.deviceId, pending.deviceId); equal(local.publicKey, pending.publicKey);
    const result = { response: structuredClone(value), signature: sign(local, "proof", value) };
    if (!this.requests.delete(id)) throw Error("Pairing request already used"); this.proofs.set(id, { proof: result, name }); return structuredClone(result);
  }
  async approve(app: ElectronPathProvider, value: Proof, fingerprint: string, name: string | null, now = new Date()): Promise<Confirmation> {
    this.prune(now); proof(value, now); const id = value.response.request.pairingId;
    const pending = this.responses.get(id); if (!pending) throw Error("Pairing response missing or already used");
    equal(pending, value.response); approval(value.response.request.publicKey, fingerprint);
    const local = await getDeviceIdentity(app); equal(local.deviceId, pending.deviceId); equal(local.publicKey, pending.publicKey);
    const result = { proof: structuredClone(value), signature: sign(local, "confirmation", value) };
    if (!this.responses.delete(id)) throw Error("Pairing response already used");
    await this.trust(app, value.response.request, name); return result;
  }
  async finish(app: ElectronPathProvider, value: Confirmation, now = new Date()) {
    this.prune(now); validateMutualTransfer({ format: "ledger-device-pairing", version: 2, kind: "confirmation", payload: value }, now);
    const id = value.proof.response.request.pairingId, pending = this.proofs.get(id);
    if (!pending) throw Error("Pairing proof missing or already used"); equal(pending.proof, value.proof);
    const local = await getDeviceIdentity(app); equal(local.deviceId, value.proof.response.request.deviceId); equal(local.publicKey, value.proof.response.request.publicKey);
    if (!this.proofs.delete(id)) throw Error("Pairing proof already used");
    return this.trust(app, value.proof.response, pending.name);
  }
  private async trust(app: ElectronPathProvider, peer: { deviceId: string; publicKey: string }, name: string | null) {
    const existing = await getTrustedDevice(app, peer.deviceId);
    if (existing && existing.publicKey !== peer.publicKey) throw Error("Trusted device public key conflict");
    return trustDevice(app, { deviceId: peer.deviceId, publicKey: peer.publicKey, name });
  }
}

// Two public files: the initial request already proves possession of its key.
type CompactRequest = Request & { signature: string };
type CompactResponse = { request: CompactRequest; deviceId: string; publicKey: string; nonce: string; signature: string };
export type CompactTransfer = { format: "ledger-device-pairing"; version: 3; kind: "request" | "response"; payload: CompactRequest | CompactResponse };
function compactRequest(value: any, now: Date) {
  fields(value, ["pairingId", "deviceId", "publicKey", "createdAt", "expiresAt", "nonce", "signature"]);
  const { signature: sig, ...body } = value;
  request(body, now); signature(sig); verify(value.publicKey, "compact-request", body, sig);
}
function compactResponse(value: any, now: Date) {
  fields(value, ["request", "deviceId", "publicKey", "nonce", "signature"]);
  compactRequest(value.request, now); identity(value); nonce(value.nonce); signature(value.signature);
  if (value.deviceId === value.request.deviceId) throw Error("Cannot pair a device with itself");
  const { signature: sig, ...body } = value; verify(value.publicKey, "compact-response", body, sig);
}
export function validateCompactTransfer(value: any, now = new Date()): CompactTransfer {
  fields(value, ["format", "version", "kind", "payload"]);
  if (value.format !== "ledger-device-pairing" || value.version !== 3) throw Error("Install the two-step update on both devices");
  if (value.kind === "request") compactRequest(value.payload, now);
  else if (value.kind === "response") compactResponse(value.payload, now);
  else throw Error("Unsupported two-step pairing file");
  return value;
}
export class CompactPairingStore {
  private pending = new Map<string, CompactRequest>();
  private received = new Map<string, number>();
  private prune(now: Date) {
    for (const [id, r] of this.pending) if (Date.parse(r.expiresAt) < now.getTime()) this.pending.delete(id);
    for (const [id, end] of this.received) if (end < now.getTime()) this.received.delete(id);
  }
  async create(app: ElectronPathProvider, now = new Date()): Promise<CompactRequest> {
    this.prune(now); const local = await getDeviceIdentity(app);
    const body: Request = { pairingId: crypto.randomUUID(), deviceId: local.deviceId, publicKey: local.publicKey, createdAt: now.toISOString(), expiresAt: new Date(now.getTime()+300000).toISOString(), nonce: crypto.randomBytes(32).toString("base64url") };
    const result = { ...body, signature: sign(local, "compact-request", body) };
    this.pending.clear(); this.pending.set(result.pairingId, result); return structuredClone(result);
  }
  async receive(app: ElectronPathProvider, value: CompactRequest, fingerprint: string, name: string | null, now = new Date()): Promise<CompactResponse> {
    this.prune(now); compactRequest(value, now); approval(value.publicKey, fingerprint);
    const local = await getDeviceIdentity(app);
    if (local.deviceId === value.deviceId) throw Error("Cannot pair a device with itself");
    if (this.received.has(value.pairingId)) throw Error("Pairing request already used");
    if (this.received.size >= 32) throw Error("Too many pairing requests");
    const body = { request: structuredClone(value), deviceId: local.deviceId, publicKey: local.publicKey, nonce: crypto.randomBytes(32).toString("base64url") };
    const result = { ...body, signature: sign(local, "compact-response", body) };
    this.received.set(value.pairingId, Date.parse(value.expiresAt));
    await this.trust(app, value, name); return result;
  }
  async finish(app: ElectronPathProvider, value: CompactResponse, fingerprint: string, name: string | null, now = new Date()) {
    this.prune(now); compactResponse(value, now); approval(value.publicKey, fingerprint);
    const pending = this.pending.get(value.request.pairingId);
    if (!pending) throw Error("Pairing request missing or already used"); equal(pending, value.request);
    const local = await getDeviceIdentity(app); equal(local.deviceId, pending.deviceId); equal(local.publicKey, pending.publicKey);
    if (!this.pending.delete(pending.pairingId)) throw Error("Pairing request already used");
    return this.trust(app, value, name);
  }
  private async trust(app: ElectronPathProvider, peer: { deviceId: string; publicKey: string }, name: string | null) {
    const existing = await getTrustedDevice(app, peer.deviceId);
    if (existing && existing.publicKey !== peer.publicKey) throw Error("Trusted device public key conflict");
    return trustDevice(app, { deviceId: peer.deviceId, publicKey: peer.publicKey, name });
  }
}
