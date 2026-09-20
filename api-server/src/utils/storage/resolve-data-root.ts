import { execFile } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  DriveCandidate,
  ElectronPathProvider,
  ResolvedDataRoot,
  StorageConfig,
} from "./storage-types";

const execFileAsync = promisify(execFile);
const STORAGE_CONFIG_FILE = "storage-config.json";
const DATA_ROOT_FOLDER = "ProgramLedgerData";
const MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024;

const DATA_SUBFOLDERS = {
  databaseDir: "database",
  attachmentsDir: "attachments",
  backupsDir: "backups",
  logsDir: "logs",
  licenseDir: "license",
  configDir: "config",
} as const;

export async function resolveDataRoot(app: ElectronPathProvider): Promise<ResolvedDataRoot> {
  const userDataPath = path.resolve(app.getPath("userData"));
  const envDataRoot = process.env.APP_DATA_ROOT;

  if (envDataRoot && envDataRoot.trim()) {
    console.log("[DATA_ROOT] Using APP_DATA_ROOT", { dataRoot: envDataRoot });
    return ensureDataRootStructure(path.resolve(envDataRoot.trim()), "config");
  }
  const configPath = path.join(userDataPath, STORAGE_CONFIG_FILE);

  const configuredRoot = await readConfiguredDataRoot(configPath);
  if (configuredRoot) {
    const validConfiguredRoot = await validateExistingWritableDirectory(configuredRoot);

    if (validConfiguredRoot) {
      console.log("[DATA_ROOT] Using configured data root", { dataRoot: validConfiguredRoot });
      return ensureDataRootStructure(validConfiguredRoot, "config");
    }

    console.warn("[DATA_ROOT] Configured data root is not usable, trying automatic detection", {
      dataRoot: configuredRoot,
    });
  }

  const automaticRoot = await resolveAutomaticDataRoot();
  if (automaticRoot) {
    console.log("[DATA_ROOT] Using automatically selected data root", { dataRoot: automaticRoot });
    return ensureDataRootStructure(automaticRoot, "auto");
  }

  console.warn("[DATA_ROOT] Falling back to Electron userData path", { dataRoot: userDataPath });
  await fs.mkdir(userDataPath, { recursive: true });
  return ensureDataRootStructure(userDataPath, "fallback");
}

async function readConfiguredDataRoot(configPath: string): Promise<string | null> {
  try {
    const rawConfig = await fs.readFile(configPath, "utf8");
    const parsedConfig = JSON.parse(rawConfig) as StorageConfig;
    const dataRoot = parsedConfig.dataRoot;

    if (typeof dataRoot !== "string" || !dataRoot.trim()) {
      console.warn("[DATA_ROOT] storage-config.json does not contain a valid dataRoot string", {
        configPath,
      });
      return null;
    }

    return path.resolve(dataRoot.trim());
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      console.log("[DATA_ROOT] storage-config.json not found, trying automatic detection", {
        configPath,
      });
      return null;
    }

    console.warn("[DATA_ROOT] Failed to read storage-config.json, trying automatic detection", {
      configPath,
      error,
    });
    return null;
  }
}

async function validateExistingWritableDirectory(directoryPath: string): Promise<string | null> {
  try {
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      return null;
    }

    await ensureWritable(directoryPath);
    return directoryPath;
  } catch {
    return null;
  }
}

async function resolveAutomaticDataRoot(): Promise<string | null> {
  const candidates = await getDriveCandidates();
  const sortedCandidates = candidates
    .filter((candidate) => isPreferredDrive(candidate))
    .sort((left, right) => right.freeBytes - left.freeBytes);

  for (const candidate of sortedCandidates) {
    const dataRoot = path.join(candidate.root, DATA_ROOT_FOLDER);

    try {
      await fs.mkdir(dataRoot, { recursive: true });
      await ensureWritable(dataRoot);
      return dataRoot;
    } catch (error) {
      console.warn("[DATA_ROOT] Candidate drive is not writable", {
        driveRoot: candidate.root,
        dataRoot,
        error,
      });
    }
  }

  return null;
}

async function getDriveCandidates(): Promise<DriveCandidate[]> {
  if (process.platform === "win32") {
    const powershellCandidates = await getWindowsFixedDriveCandidates();
    if (powershellCandidates.length > 0) {
      return powershellCandidates;
    }

    return getWindowsFallbackDriveCandidates();
  }

  return getNonWindowsDriveCandidates();
}

async function getWindowsFixedDriveCandidates(): Promise<DriveCandidate[]> {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,FreeSpace | ConvertTo-Json -Compress",
      ],
      { windowsHide: true },
    );

    return parseWindowsLogicalDisks(stdout);
  } catch (error) {
    console.warn("[DATA_ROOT] Windows drive detection failed, using drive-letter fallback", {
      error,
    });
    return [];
  }
}

function parseWindowsLogicalDisks(stdout: string): DriveCandidate[] {
  if (!stdout.trim()) {
    return [];
  }

  const parsed = JSON.parse(stdout) as unknown;
  const disks = Array.isArray(parsed) ? parsed : [parsed];

  return disks.flatMap((disk) => {
    if (!isLogicalDisk(disk)) {
      return [];
    }

    return [
      {
        root: `${disk.DeviceID}\\`,
        freeBytes: Number(disk.FreeSpace) || 0,
        isRemovable: disk.DriveType === 2,
      },
    ];
  });
}

async function getWindowsFallbackDriveCandidates(): Promise<DriveCandidate[]> {
  const candidates: DriveCandidate[] = [];

  for (let charCode = "D".charCodeAt(0); charCode <= "Z".charCodeAt(0); charCode += 1) {
    const root = `${String.fromCharCode(charCode)}:\\`;
    const freeBytes = await getFreeBytes(root);

    if (freeBytes !== null) {
      candidates.push({ root, freeBytes, isRemovable: false });
    }
  }

  return candidates;
}

async function getNonWindowsDriveCandidates(): Promise<DriveCandidate[]> {
  const homeRoot = path.parse(os.homedir()).root;
  const freeBytes = await getFreeBytes(homeRoot);

  if (freeBytes === null) {
    return [];
  }

  return [{ root: homeRoot, freeBytes, isRemovable: false }];
}

function isPreferredDrive(candidate: DriveCandidate): boolean {
  return !isSystemDrive(candidate.root) && !candidate.isRemovable && candidate.freeBytes >= MIN_FREE_BYTES;
}

function isSystemDrive(root: string): boolean {
  return path.resolve(root).toUpperCase().startsWith("C:\\");
}

async function getFreeBytes(root: string): Promise<number | null> {
  try {
    const stats = await fs.statfs(root);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

async function ensureDataRootStructure(
  dataRoot: string,
  source: ResolvedDataRoot["source"],
): Promise<ResolvedDataRoot> {
  await fs.mkdir(dataRoot, { recursive: true });

  const resolvedDataRoot = path.resolve(dataRoot);
  const result: ResolvedDataRoot = {
    dataRoot: resolvedDataRoot,
    databaseDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.databaseDir),
    attachmentsDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.attachmentsDir),
    backupsDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.backupsDir),
    logsDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.logsDir),
    licenseDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.licenseDir),
    configDir: path.join(resolvedDataRoot, DATA_SUBFOLDERS.configDir),
    source,
  };

  await Promise.all([
    fs.mkdir(result.databaseDir, { recursive: true }),
    fs.mkdir(result.attachmentsDir, { recursive: true }),
    fs.mkdir(result.backupsDir, { recursive: true }),
    fs.mkdir(result.logsDir, { recursive: true }),
    fs.mkdir(result.licenseDir, { recursive: true }),
    fs.mkdir(result.configDir, { recursive: true }),
  ]);

  await ensureWritable(resolvedDataRoot);

  console.log("[DATA_ROOT] About to hide data root", resolvedDataRoot);
  await hideDataRoot(resolvedDataRoot);
  console.log("[DATA_ROOT] Hide data root completed");
  
  console.log("[DATA_ROOT] Data root structure is ready", result);
  return result;
}

async function ensureWritable(directoryPath: string): Promise<void> {
  await fs.access(directoryPath, constants.W_OK);

  const probePath = path.join(
    directoryPath,
    `.ledger-write-test-${process.pid}-${Date.now()}`,
  );

  try {
    await fs.writeFile(probePath, "test", "utf8");
  } finally {
    await fs.rm(probePath, { force: true });
  }
}

async function hideDataRoot(directoryPath: string): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  try {
    await execFileAsync("attrib", ["+h", "+s", directoryPath], {
      windowsHide: true,
    });
  } catch (error) {
    console.warn("[DATA_ROOT] Failed to hide data root", {
      directoryPath,
      error,
    });
  }
}

function isLogicalDisk(value: unknown): value is {
  DeviceID: string;
  DriveType: number;
  FreeSpace: number | string | null;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const disk = value as Record<string, unknown>;
  return typeof disk.DeviceID === "string" && typeof disk.DriveType === "number";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
