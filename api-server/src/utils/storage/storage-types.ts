export type DataRootSource = "config" | "auto" | "fallback";

export interface ElectronPathProvider {
  getPath(name: "userData"): string;
}

export interface ResolvedDataRoot {
  dataRoot: string;
  databaseDir: string;
  attachmentsDir: string;
  backupsDir: string;
  logsDir: string;
  licenseDir: string;
  configDir: string;
  source: DataRootSource;
}

export interface StorageConfig {
  dataRoot?: unknown;
}

export interface DriveCandidate {
  root: string;
  freeBytes: number;
  isRemovable: boolean;
}
