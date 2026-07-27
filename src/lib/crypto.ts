import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Explicit ciphertext marker.
 *
 * Detecting "is this already encrypted?" by attempting a base64 decode and
 * checking the byte length is unreliable: Buffer.from(value, "base64") ignores
 * characters outside the base64 alphabet, so any sufficiently long plaintext
 * API key (e.g. "sk-ant-api03-...") decodes to more than IV+TAG bytes and was
 * misclassified as ciphertext. That caused two failures at once — the key was
 * persisted in plaintext, and the later decrypt attempt threw and returned
 * null, silently dropping the configured key.
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for API key encryption. Generate one with: openssl rand -base64 32"
    );
  }
  return scryptSync(secret, "coreos-salt", 32);
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const payload = ciphertext.startsWith(PREFIX)
    ? ciphertext.slice(PREFIX.length)
    : ciphertext;
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith(PREFIX);
}

export function encryptIfPlaintext(value: string | null): string | null {
  if (!value || isEncrypted(value)) return value;
  return encrypt(value);
}

export function decryptIfEncrypted(value: string | null): string | null {
  if (!value) return null;
  if (isEncrypted(value)) {
    try {
      return decrypt(value);
    } catch {
      return null;
    }
  }
  // Backward compatibility: values encrypted before the enc:v1: prefix was
  // introduced won't have the prefix. Try to decrypt; if the auth tag check
  // fails, the value is plaintext and should be returned as-is. AES-GCM
  // authentication makes a false positive cryptographically impossible.
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}
