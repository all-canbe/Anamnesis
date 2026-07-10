import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const TAG_LENGTH = 16; // 16 bytes auth tag

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set. Run: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return buf;
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a hex-encoded string: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString("hex");
}

/**
 * Decrypt a hex-encoded ciphertext produced by encrypt().
 * Returns the original plaintext, or null if decryption fails.
 */
export function decrypt(encryptedHex: string): string | null {
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(encryptedHex, "hex");

    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
      return null;
    }

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(buf.length - TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Check if encryption is configured (ENCRYPTION_KEY is set).
 * If not configured, encryption is a no-op.
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}