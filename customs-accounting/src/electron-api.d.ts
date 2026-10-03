export {};

declare global {
  interface Window {
    electronAPI?: {
      getDeviceIdentity?: () => Promise<{
        deviceId: string;
        publicKey: string;
        fingerprint: string;
        createdAt: string;
      }>;

      exportDevicePairingFile?: (transfer: { format: "ledger-device-pairing"; version: 1; kind: "request" | "response" | "proof"; payload: unknown }) => Promise<{ canceled: boolean }>;
      importDevicePairingFile?: () => Promise<{ format: "ledger-device-pairing"; version: 1; kind: "request" | "response" | "proof"; payload: unknown } | null>;
      createDevicePairingRequest?: () => Promise<unknown>;
      receiveDevicePairingRequest?: (request: unknown) => Promise<unknown>;
      signDevicePairingResponse?: (response: unknown) => Promise<unknown>;
      completeDevicePairing?: (
        response: unknown,
        proof: unknown,
        fingerprint: string,
        name?: string
      ) => Promise<unknown>;
      listTrustedLedgerDevices?: () => Promise<Array<{
        deviceId: string;
        publicKey: string;
        name: string | null;
        trustedAt: string;
        revokedAt: string | null;
      }>>;
      listPeerEndpoints?: () => Promise<Array<{ deviceId: string; name: string | null; address: string }>>;
      setPeerEndpoint?: (deviceId: string, address: string) => Promise<{ ok: boolean }>;
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
