const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createAttachmentServer } = require('../scripts/attachment-service/server.cjs');
test('signed transfer, replay, tamper, revocation and live storage changes', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-service-'));
  const userData = path.join(tmp, 'user');
  const data = path.join(tmp, 'data');
  await fs.mkdir(userData);
  await fs.mkdir(path.join(data, 'database'), { recursive: true });
  const dir = path.join(data, 'attachments', 'declarations', '12345678901234');
  await fs.mkdir(dir, { recursive: true });
  const content = Buffer.from('ledger attachment');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  await fs.writeFile(path.join(dir, 'a.pdf'), content);
  const db = new DatabaseSync(path.join(data, 'database', 'local.db'));
  db.exec('CREATE TABLE invoice_attachments (sync_id TEXT, declaration_base_number TEXT, stored_name TEXT, file_hash TEXT, file_size INTEGER, deleted_at INTEGER)');
  const syncId = crypto.randomUUID();
  db.prepare('INSERT INTO invoice_attachments VALUES (?, ?, ?, ?, ?, NULL)').run(syncId, '12345678901234', 'a.pdf', hash, content.length);
  db.close();
  const keys = () => crypto.generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const local = { deviceId: 'A'.repeat(32), ...keys() };
  const peer = { deviceId: 'B'.repeat(32), ...keys() };
  const trust = { devices: [{ deviceId: peer.deviceId, publicKey: peer.publicKey }] };
  await fs.writeFile(path.join(userData, 'device-identity.json'), JSON.stringify(local));
  await fs.writeFile(path.join(userData, 'trusted-devices.json'), JSON.stringify(trust));
  await fs.writeFile(path.join(userData, 'storage-config.json'), JSON.stringify({ dataRoot: data }));
  const server = createAttachmentServer({ userData, openDatabase: file => new DatabaseSync(file, { readOnly: true }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/peer-attachments/${syncId}`;
  const headers = () => {
    const stamp = String(Date.now()), nonce = crypto.randomBytes(16).toString('hex');
    const canonical = ['LEDGER_PEER_ATTACHMENT_V1', peer.deviceId, local.deviceId, syncId, stamp, nonce].join('|');
    return { 'X-Ledger-Device-Id': peer.deviceId, 'X-Ledger-Target-Id': local.deviceId,
      'X-Ledger-Timestamp': stamp, 'X-Ledger-Nonce': nonce,
      'X-Ledger-Signature': crypto.sign(null, Buffer.from(canonical), peer.privateKey).toString('base64') };
  };
  try {
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await fetch(url.replace('/api/peer-attachments/' + syncId, '/api/users'))).status, 404);
    const first = headers();
    const response = await fetch(url, { headers: first });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
    const canonical = ['LEDGER_PEER_ATTACHMENT_REPLY_V1', local.deviceId, peer.deviceId, syncId, first['X-Ledger-Nonce'], hash, String(content.length)].join('|');
    assert.ok(crypto.verify(null, Buffer.from(canonical), local.publicKey, Buffer.from(response.headers.get('x-ledger-reply-signature'), 'base64')));
    assert.equal((await fetch(url, { headers: first })).status, 403);
    await fs.writeFile(path.join(dir, 'a.pdf'), Buffer.alloc(content.length));
    assert.equal((await fetch(url, { headers: headers() })).status, 404);
    await fs.writeFile(path.join(dir, 'a.pdf'), content);
    const moved = path.join(tmp, 'moved');
    await fs.rename(data, moved);
    await fs.writeFile(path.join(userData, 'storage-config.json'), JSON.stringify({ dataRoot: moved }));
    const movedReply = await fetch(url, { headers: headers() });
    assert.equal(movedReply.status, 200); await movedReply.arrayBuffer();
    trust.devices[0].revokedAt = Date.now();
    await fs.writeFile(path.join(userData, 'trusted-devices.json'), JSON.stringify(trust));
    assert.equal((await fetch(url, { headers: headers() })).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
