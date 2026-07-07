import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Whitelist: routes that don't require authentication
const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/me", "/api/auth/logout", "/api/auth/dev-login"];

// Routes that require authentication
const PROTECTED_PREFIXES = ["/api/"];

// Verify JWT from Authorization header or cookie, return username or null
async function verifyAuth(request: NextRequest): Promise<string | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  const secret = new TextEncoder().encode(jwtSecret);

  // Check Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return verifyJWT(token, secret);
  }

  // Check cookie
  const cookieToken = request.cookies.get("zhiyi_token")?.value;
  if (cookieToken) return verifyJWT(cookieToken, secret);

  return null;
}

async function verifyJWT(token: string, secret: Uint8Array): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check if this is a protected API route
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Verify authentication
  const authenticated = await verifyAuth(request);
  if (!authenticated) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Please provide a valid Bearer token." },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};