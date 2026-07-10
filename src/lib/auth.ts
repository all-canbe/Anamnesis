import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getUserByEmail } from "./turso";

// 使用 Web Crypto API（Edge Runtime 兼容），Node.js 18+ 同样支持
function generateUUID(): string {
  return globalThis.crypto.randomUUID();
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// 已知的测试密钥 — 生产环境使用这些密钥会触发警告
const KNOWN_TEST_KEYS = new Set([
  "test-secret-key-at-least-32-chars-long!!",
  "your-secret-key-at-least-32-chars!!",
  "change-me-please-at-least-32-chars",
  "dev-secret-key-at-least-32-chars-long",
]);

// Validate environment variables at startup
export function validateAuthEnv(): void {
  if (!JWT_SECRET) {
    throw new Error(
      "Missing required auth environment variable: JWT_SECRET\n" +
      "Please set JWT_SECRET in .env.local before starting the server."
    );
  }
  if (Buffer.from(JWT_SECRET).length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
}

/** 生产环境使用测试密钥时发出警告 */
export function warnProductionJwtSecret(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!JWT_SECRET) return;

  if (KNOWN_TEST_KEYS.has(JWT_SECRET)) {
    console.error(
      "\n" +
      "╔══════════════════════════════════════════════════════════════╗\n" +
      "║  SECURITY WARNING: JWT_SECRET is a known test key!          ║\n" +
      "║  请立即更换为强随机密钥，否则生产环境存在安全风险。        ║\n" +
      "║  Generate: node -e \"console.log(require('crypto')           ║\n" +
      "║    .randomBytes(64).toString('hex'))\"                       ║\n" +
      "╚══════════════════════════════════════════════════════════════╝\n"
    );
  }
}

// Create a JWT token
export async function createToken(userId: string): Promise<string> {
  validateAuthEnv();
  const secret = new TextEncoder().encode(JWT_SECRET!);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(generateUUID())
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

// Verify a JWT token and extract userId
export async function verifyToken(token: string): Promise<string | null> {
  if (!token || !JWT_SECRET) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

// ─── 邮箱登录验证 ───

/** 验证邮箱 + 密码，返回 userId */
export async function validateEmailLogin(
  email: string,
  password: string
): Promise<string | null> {
  try {
    const user = await getUserByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password_hash);
    return valid ? user.id : null;
  } catch {
    return null; // 数据库不可用时降级，不影响 admin 登录
  }
}

// ─── 兼容旧版 admin 登录 ───

/** 验证 admin 用户名 + 密码 */
export async function validateAdminLogin(
  username: string,
  password: string
): Promise<boolean> {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) return false;
  if (username !== ADMIN_USERNAME) return false;
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}