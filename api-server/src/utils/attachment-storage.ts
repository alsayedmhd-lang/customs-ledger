import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export type AttachmentIdentity = {
  declarationBaseNumber: string;
  storedName: string;
  fileHash: string;
  fileSize: number;
};

function validateIdentity(item: AttachmentIdentity): void {
  if (!/^[a-zA-Z0-9]+$/.test(item.declarationBaseNumber)) {
    throw new Error("Invalid declaration base number");
  }

  if (
    !item.storedName ||
    item.storedName === "." ||
    item.storedName.includes("..") ||
    item.storedName.includes("/") ||
    item.storedName.includes("\\") ||
    item.storedName.includes(":") ||
    /[\x00-\x1f]/.test(item.storedName) ||
    path.basename(item.storedName) !== item.storedName
  ) {
    throw new Error("Invalid stored attachment name");
  }

  if (!/^[a-fA-F0-9]{64}$/.test(item.fileHash)) {
    throw new Error("Invalid SHA-256 hash");
  }

  if (!Number.isSafeInteger(item.fileSize) || item.fileSize < 0) {
    throw new Error("Invalid attachment size");
  }
}

function getAttachmentPath(item: AttachmentIdentity): {
  root: string;
  directory: string;
  filePath: string;
} {
  validateIdentity(item);

  const dataRoot = process.env.APP_DATA_ROOT?.trim();

  if (!dataRoot || !path.isAbsolute(dataRoot)) {
    throw new Error("APP_DATA_ROOT is not configured");
  }

  const root = path.resolve(dataRoot, "attachments");
  const directory = path.resolve(
    root,
    "declarations",
    item.declarationBaseNumber
  );
  const filePath = path.resolve(directory, item.storedName);

  const relative = path.relative(root, filePath);

  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Attachment path is outside storage root");
  }

  return { root, directory, filePath };
}

async function calculateHash(filePath: string): Promise<string> {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export async function verifyLocalAttachment(
  item: AttachmentIdentity
): Promise<boolean> {
  const { root, filePath } = getAttachmentPath(item);

  try {
    const realRoot = await fs.realpath(root);
    const realFile = await fs.realpath(filePath);
    const relative = path.relative(realRoot, realFile);

    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return false;
    }

    const stat = await fs.stat(realFile);

    if (!stat.isFile() || stat.size !== item.fileSize) {
      return false;
    }

    return (await calculateHash(realFile)) === item.fileHash.toLowerCase();
  } catch {
    return false;
  }
}

export async function receiveVerifiedAttachment(
  item: AttachmentIdentity,
  source: Readable
): Promise<string> {
  const { root, directory, filePath } = getAttachmentPath(item);

  if (await verifyLocalAttachment(item)) {
    source.destroy();
    return filePath;
  }

  await fs.mkdir(directory, { recursive: true });

  const realRoot = await fs.realpath(root);
  const realDirectory = await fs.realpath(directory);
  const relative = path.relative(realRoot, realDirectory);

  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Attachment directory is outside storage root");
  }

  const temporaryPath = path.join(
    realDirectory,
    `.ledger-attachment-${randomUUID()}.tmp`
  );

  try {
    let receivedBytes = 0;

    source.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;

      if (receivedBytes > item.fileSize) {
        source.destroy(new Error("Attachment exceeds expected size"));
      }
    });

    await pipeline(
      source,
      createWriteStream(temporaryPath, { flags: "wx" })
    );

    const stat = await fs.stat(temporaryPath);

    if (stat.size !== item.fileSize) {
      throw new Error("Received attachment size mismatch");
    }

    const actualHash = await calculateHash(temporaryPath);

    if (actualHash !== item.fileHash.toLowerCase()) {
      throw new Error("Received attachment SHA-256 mismatch");
    }

    const destination = path.join(realDirectory, item.storedName);

    if (await verifyLocalAttachment(item)) {
      return destination;
    }

    try {
      await fs.link(temporaryPath, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        if (await verifyLocalAttachment(item)) {
          return destination;
        }

        throw new Error(
          "Attachment destination already exists with different content"
        );
      }

      throw error;
    }

    return destination;
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

