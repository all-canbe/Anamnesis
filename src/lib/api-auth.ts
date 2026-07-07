import { jwtVerify } from "jose";

/**
 * Verify JWT token from the request's Authorization header or cookie.
 * Used by route handlers for defense-in-depth auth checking.
 * Returns username if valid, null otherwise.
 */
export async function verifyRequestAuth(request: Request): Promise<string | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  const secret = new TextEncoder().encode(jwtSecret);

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secret);
        return (payload.sub as string) || null;
      } catch {}
    }
  }

  // Check cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/zhiyi_token=([^;]+)/);
  if (match) {
    try {
      const { payload } = await jwtVerify(match[1], secret);
      return (payload.sub as string) || null;
    } catch {}
  }

  return null;
}

export function unauthorizedResponse() {
  return Response.json(
    { ok: false, error: "Unauthorized. Please provide a valid Bearer token." },
    { status: 401 }
  );
}