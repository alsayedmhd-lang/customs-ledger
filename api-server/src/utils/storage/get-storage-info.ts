import fs from "node:fs/promises";
import { resolveDataRoot } from "./resolve-data-root";
import type { ElectronPathProvider } from "./storage-types";

export async function getStorageInfo(app: ElectronPathProvider) {
  const resolved = await resolveDataRoot(app);

  let exists = false;

  try {
    const stats = await fs.stat(resolved.dataRoot);
    exists = stats.isDirectory();
  } catch {
    exists = false;
  }

  return {
    dataRoot: resolved.dataRoot,
    databaseDir: resolved.databaseDir,
    attachmentsDir: resolved.attachmentsDir,
    backupsDir: resolved.backupsDir,
    logsDir: resolved.logsDir,
    licenseDir: resolved.licenseDir,
    configDir: resolved.configDir,
    source: resolved.source,
    exists,
  };
}
