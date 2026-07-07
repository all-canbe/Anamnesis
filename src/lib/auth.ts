import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Validate environment variables at startup
export function validateAuthEnv(): void {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    throw new Error(
      "Missing required auth environment variables: ADMIN_USERNAME, ADMIN_PASSWORD_HASH, JWT_SECRET\n" +
      "Please set these in .env.local before starting the server."
    );
  }
  if (Buffer.from(JWT_SECRET).length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
}

// Create a JWT token
export async function createToken(username: string): Promise<string> {
  validateAuthEnv();
  const secret = new TextEncoder().encode(JWT_SECRET!);
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

// Verify a JWT token and extract username
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

// Validate credentials and return a token if valid
export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  validateAuthEnv();
  if (username !== ADMIN_USERNAME) return false;
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH!);
}

// Hash a password for initial setup
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
