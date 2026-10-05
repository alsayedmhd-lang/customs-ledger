'use strict';
// Read-only, device-authenticated attachment server. No user API or sync worker.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const PORT = 3001;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DEVICE = /^[a-f0-9]{32}$/i;
const inside = (root, file) => {
  const rel = path.relative(root, file);
  return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
};
function createAttachmentServer({ userData, openDatabase }) {
  if (!path.isAbsolute(userData) || userData === path.parse(userData).root) throw new Error('Invalid userData');
  const seen = new Map();
  let active = 0;
  const server = http.createServer(async (req, res) => {
    let handle;
    let slot = false;
    const end = code => { res.writeHead(code, { 'Cache-Control': 'no-store' }); res.end(); };
    try {
      const match = /^\/api\/peer-attachments\/([a-f0-9-]+)$/.exec(req.url || '');
      if (req.method !== 'GET' || !match) return end(404);
      const syncId = match[1].toLowerCase();
      const sender = String(req.headers['x-ledger-device-id'] || '').toUpperCase();
      const target = String(req.headers['x-ledger-target-id'] || '').toUpperCase();
      const stamp = String(req.headers['x-ledger-timestamp'] || '');
      const nonce = String(req.headers['x-ledger-nonce'] || '');
      const signature = String(req.headers['x-ledger-signature'] || '');
      if (!UUID.test(syncId) || !DEVICE.test(sender) || !DEVICE.test(target) ||
          !/^\d{13}$/.test(stamp) || Math.abs(Date.now() - Number(stamp)) > 60000 ||
          !/^[a-f0-9]{32}$/i.test(nonce) || !signature || signature.length > 200) return end(403);
      // Reload trust and storage every request: revocation and storage changes take effect immediately.
      const local = JSON.parse(await fs.readFile(path.join(userData, 'device-identity.json'), 'utf8'));
      const trust = JSON.parse(await fs.readFile(path.join(userData, 'trusted-devices.json'), 'utf8'));
      const peer = trust.devices?.find(d => d.deviceId === sender && !d.revokedAt);
      if (local.deviceId !== target || !peer?.publicKey) return end(403);
      const canonical = ['LEDGER_PEER_ATTACHMENT_V1', sender, target, syncId, stamp, nonce].join('|');
      if (!crypto.verify(null, Buffer.from(canonical), peer.publicKey, Buffer.from(signature, 'base64'))) return end(403);
      for (const [key, expiry] of seen) if (expiry < Date.now()) seen.delete(key);
      const replay = sender + ':' + nonce;
      if (seen.has(replay)) return end(403);
      // Do not evict unexpired nonces: fail closed at capacity.
      if (seen.size >= 4096 || active >= 4) return end(429);
      seen.set(replay, Date.now() + 120000);
      active++; slot = true;
      const config = JSON.parse(await fs.readFile(path.join(userData, 'storage-config.json'), 'utf8'));
      if (typeof config.dataRoot !== 'string' || !path.isAbsolute(config.dataRoot) ||
          path.resolve(config.dataRoot) === path.parse(config.dataRoot).root) return end(503);
      const db = openDatabase(path.join(config.dataRoot, 'database', 'local.db'));
      let item;
      try {
        item = db.prepare('SELECT declaration_base_number, stored_name, file_hash, file_size FROM invoice_attachments WHERE sync_id = ? AND deleted_at IS NULL LIMIT 1').get(syncId);
      } finally { db.close(); }
      if (!item || !/^[a-z0-9]+$/i.test(item.declaration_base_number) ||
          typeof item.stored_name !== 'string' || !item.stored_name ||
          /[\\/:\x00-\x1f]/.test(item.stored_name) || item.stored_name.includes('..') || item.stored_name === '.' ||
          !/^[a-f0-9]{64}$/i.test(item.file_hash || '') ||
          !Number.isSafeInteger(item.file_size) || item.file_size < 0) return end(404);
      const root = await fs.realpath(path.join(config.dataRoot, 'attachments'));
      const file = await fs.realpath(path.join(root, 'declarations', item.declaration_base_number, item.stored_name));
      if (!inside(root, file)) return end(404);
      handle = await fs.open(file, 'r');
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== item.file_size) return end(404);
      const hash = crypto.createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
      if (hash.digest('hex') !== item.file_hash.toLowerCase()) return end(404);
      const reply = ['LEDGER_PEER_ATTACHMENT_REPLY_V1', target, sender, syncId, nonce,
        item.file_hash.toLowerCase(), String(item.file_size)].join('|');
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream', 'Content-Length': String(item.file_size),
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'X-Ledger-File-Hash': item.file_hash.toLowerCase(),
        'X-Ledger-Reply-Signature': crypto.sign(null, Buffer.from(reply), local.privateKey).toString('base64')
      });
      await pipeline(handle.createReadStream({ autoClose: false, start: 0 }), res);
    } catch (error) {
      if (!res.headersSent) end(error.code === 'ENOENT' ? 404 : 503);
      else res.destroy();
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (slot) active--;
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.timeout = 60000;
  return server;
}
module.exports = { createAttachmentServer };
if (require.main === module) {
  const [userData, modulePath] = process.argv.slice(2);
  const Database = require(modulePath);
  const server = createAttachmentServer({ userData,
    openDatabase: file => new Database(file, { readonly: true, fileMustExist: true, timeout: 3000 }) });
  server.on('error', error => { console.error(error.message); process.exit(1); });
  server.listen(PORT, '0.0.0.0', () => console.log('Ledger attachments listening on ' + PORT));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
