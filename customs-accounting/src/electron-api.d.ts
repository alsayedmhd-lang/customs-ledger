export {};

declare global {
  interface Window {
    electronAPI?: {
      getLicenseDeviceId?: () => Promise<string>;

      getLicenseStatus?: () => Promise<{
        valid?: boolean;
        status?: string;
        reason?: string;
        customerName?: string;
        licenseId?: string;
        hardwareId?: string;
        deviceId?: string;
        currentDeviceId?: string;
        issuedAt?: string;
        expiresAt?: string;
        expiryDate?: string;
      } | null>;

      saveCurrentLicense?: (license: unknown) => Promise<{
        ok?: boolean;
        success?: boolean;
        message?: string;
      } | null>;

      chooseDataRootFolder?: () => Promise<
        | { ok: true; canceled: false; path: string }
        | { ok: false; canceled: boolean; error?: string }
      >;

      testDataRootWrite?: (targetPath: string) => Promise<{
        ok: boolean;
        writable: boolean;
        path: string;
        error?: string;
      }>;

      saveDataRootConfig?: (targetPath: string) => Promise<{
        ok: boolean;
        configPath?: string;
        dataRoot?: string;
        error?: string;
      }>;

      openExternalPrintWindow?: (url: string) => Promise<unknown>;
      openExternalFile?: (relativePath: string) => Promise<unknown>;
    };
  }
}
