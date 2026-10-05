import { getLocalDb } from "../utils/local-db";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { invoiceAttachmentsTable } from "@workspace/db";
import { openVerifiedAttachment } from "../utils/attachment-storage";

// This deliberately does NOT use the user's JWT: it is a separate device-to-device
// route. It is disabled unless Electron passes its real userData path to the backend.
const router: IRouter = Router();
const seen = new Map<string, number>();
const MAX_SKEW = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE = /^[0-9a-f]{32}$/i;

router.get("/peer-attachments/:syncId", async (req, res) => {
  let handle: Awaited<ReturnType<typeof openVerifiedAttachment>> = null;
  try {
    const userData = process.env.LEDGER_ELECTRON_USER_DATA?.trim();
    if (!userData || !path.isAbsolute(userData)) return res.sendStatus(503);
    const root = path.resolve(userData);
    if (root === path.parse(root).root) return res.sendStatus(503);

    const syncId = String(req.params.syncId ?? "").toLowerCase();
    const senderId = String(req.get("x-ledger-device-id") ?? "").toUpperCase();
    const targetId = String(req.get("x-ledger-target-id") ?? "").toUpperCase();
    const timestamp = String(req.get("x-ledger-timestamp") ?? "");
    const nonce = String(req.get("x-ledger-nonce") ?? "");
    const signature = String(req.get("x-ledger-signature") ?? "");
    const time = Number(timestamp);
    if (!UUID.test(syncId) || !DEVICE.test(senderId) || !DEVICE.test(targetId) ||
        !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - time) > MAX_SKEW ||
        !/^[a-f0-9]{32}$/i.test(nonce) || signature.length > 200) {
      return res.sendStatus(403);
    }
    const local = JSON.parse(await fs.readFile(path.join(root, "device-identity.json"), "utf8"));
    const trust = JSON.parse(await fs.readFile(path.join(root, "trusted-devices.json"), "utf8"));
    if (local.deviceId !== targetId || !Array.isArray(trust.devices)) return res.sendStatus(403);
    const peer = trust.devices.find((d: any) => d.deviceId === senderId && !d.revokedAt);
    if (!peer?.publicKey || !crypto.createPublicKey(peer.publicKey)) return res.sendStatus(403);
    const payload = ["LEDGER_PEER_ATTACHMENT_V1", senderId, targetId, syncId, timestamp, nonce].join("|");
    const verified = crypto.verify(null, Buffer.from(payload), peer.publicKey, Buffer.from(signature, "base64"));
    if (!verified) return res.sendStatus(403);

    // Replays are rejected, including when a requested attachment is missing.
    const replay = `${senderId}:${nonce}`;
    for (const [key, exp] of seen) if (exp < Date.now()) seen.delete(key);
    if (seen.has(replay)) return res.sendStatus(403);
    seen.set(replay, Date.now() + MAX_SKEW * 2);
    if (seen.size > 4096) seen.delete(seen.keys().next().value!);

    const [attachment] = await getLocalDb()
      .select().from(invoiceAttachmentsTable)
      .where(and(eq(invoiceAttachmentsTable.syncId, syncId), isNull(invoiceAttachmentsTable.deletedAt)))
      .limit(1);
    if (!attachment || !attachment.fileHash || !/^[a-f0-9]{64}$/i.test(attachment.fileHash) ||
        attachment.fileSize === null || !Number.isSafeInteger(attachment.fileSize) || attachment.fileSize < 0) {
      return res.sendStatus(404);
    }
    handle = await openVerifiedAttachment({
      declarationBaseNumber: attachment.declarationBaseNumber,
      storedName: attachment.storedName,
      fileHash: attachment.fileHash,
      fileSize: attachment.fileSize,
    });
    if (!handle) return res.sendStatus(404);

    // Authenticate the reply too, binding the response to THIS request.
    const answer = ["LEDGER_PEER_ATTACHMENT_REPLY_V1", targetId, senderId, syncId,
      nonce, attachment.fileHash.toLowerCase(), String(attachment.fileSize)].join("|");
    const replySignature = crypto.sign(null, Buffer.from(answer), local.privateKey).toString("base64");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(attachment.fileSize));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Ledger-File-Hash", attachment.fileHash.toLowerCase());
    res.setHeader("X-Ledger-Reply-Signature", replySignature);
    const stream = handle.createReadStream({ autoClose: false, start: 0 });
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      const current = handle;
      handle = null;
      if (current) void current.close().catch(() => undefined);
    };
    res.on("close", () => { if (!res.writableFinished) stream.destroy(); });
    stream.on("error", err => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy(err);
    });
    stream.once("close", cleanup);
    stream.once("end", cleanup);
    stream.pipe(res);
  } catch (err) {
    if (handle) await handle.close().catch(() => undefined);
    if (!res.headersSent) return res.sendStatus(403);
    return res.destroy();
  }

  return undefined;
});
export default router;
