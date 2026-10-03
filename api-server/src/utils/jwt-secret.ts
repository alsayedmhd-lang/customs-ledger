import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cachedSecret: string | undefined;

function validateSecret(value: string): string {
  if (Buffer.byteLength(value, "utf8") < 32 || value === "atw-customs-secret-2026") {
    throw new Error("JWT_SECRET must contain at least 32 bytes and must not use the retired Ledger key");
  }
  return value;
}

/** One key for sessions, OTP and password reset; never generated per login. */
export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.JWT_SECRET?.trim();
  // Ignore the retired public key if it remains in an old packaged .env.
  if (configured && configured !== "atw-customs-secret-2026") {
    return (cachedSecret = validateSecret(configured));
  }
  const userData = process.env.LEDGER_ELECTRON_USER_DATA?.trim();
  const dataRoot = process.env.APP_DATA_ROOT?.trim();
  const sqlitePath = process.env.SQLITE_DB_PATH?.trim();
  const explicitFile = process.env.JWT_SECRET_FILE?.trim();
  const storageRoot = userData || dataRoot || (sqlitePath ? path.dirname(path.dirname(path.resolve(sqlitePath))) : undefined);
  if (!explicitFile && !storageRoot) {
    throw new Error("Configure JWT_SECRET, JWT_SECRET_FILE or APP_DATA_ROOT before starting Ledger");
  }
  const secretFile = explicitFile
    ? path.resolve(explicitFile)
    : path.join(path.resolve(storageRoot!), "security", "jwt-secret.key");
  fs.mkdirSync(path.dirname(secretFile), { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(secretFile, crypto.randomBytes(48).toString("base64url") + "\n", {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const stat = fs.lstatSync(secretFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) {
    throw new Error("Invalid Ledger JWT key file");
  }
  if (process.platform !== "win32") fs.chmodSync(secretFile, 0o600);
  return (cachedSecret = validateSecret(fs.readFileSync(secretFile, "utf8").trim()));
}
