import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { warnProductionJwtSecret } from "@/lib/auth";

let securityWarned = false;
if (!securityWarned) {
  securityWarned = true;
  warnProductionJwtSecret();
}

const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/send-code",
  "/api/auth/captcha",
  "/api/auth/logout",
];

async function verifyAuth(request: NextRequest): Promise<string | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  const secret = new TextEncoder().encode(jwtSecret);

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return verifyJWT(token, secret);
  }

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
  const method = request.method;

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authenticated = await verifyAuth(request);
  if (!authenticated) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
