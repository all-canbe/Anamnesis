// Simple server-side token auth for CLI API access
// Single account: admin / kb65

const CREDENTIALS = { username: "admin", password: "kb65" };
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory token store (per serverless instance, but acceptable for CLI use)
const tokens = new Map<string, { token: string; createdAt: number }>();

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createToken(): string {
  const token = generateToken();
  tokens.set(token, { token, createdAt: Date.now() });
  // Keep map size manageable
  if (tokens.size > 100) {
    const oldest = [...tokens.entries()]
      .filter(([, v]) => Date.now() - v.createdAt > TOKEN_EXPIRY_MS)
      .map(([k]) => k);
    oldest.forEach((k) => tokens.delete(k));
  }
  return token;
}

export function verifyToken(token: string): boolean {
  const entry = tokens.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TOKEN_EXPIRY_MS) {
    tokens.delete(token);
    return false;
  }
  return true;
}

export function validateCredentials(
  username: string,
  password: string
): boolean {
  return username === CREDENTIALS.username && password === CREDENTIALS.password;
}