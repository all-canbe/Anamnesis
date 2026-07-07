/**
 * Auth Module Tests
 *
 * Tests credential validation, token creation/verification with bcrypt + JWT.
 */
import { describe, it, expect } from "vitest";
import { validateCredentials, createToken, verifyToken } from "@/lib/auth";

describe("validateCredentials", () => {
  it("should accept correct credentials", async () => {
    const result = await validateCredentials("admin", "kb65");
    expect(result).toBe(true);
  });

  it("should reject wrong password", async () => {
    const result = await validateCredentials("admin", "wrong");
    expect(result).toBe(false);
  });

  it("should reject wrong username", async () => {
    const result = await validateCredentials("root", "kb65");
    expect(result).toBe(false);
  });

  it("should reject both wrong", async () => {
    const result = await validateCredentials("root", "wrong");
    expect(result).toBe(false);
  });

  it("should reject empty username", async () => {
    const result = await validateCredentials("", "kb65");
    expect(result).toBe(false);
  });

  it("should reject empty password", async () => {
    const result = await validateCredentials("admin", "");
    expect(result).toBe(false);
  });

  it("should be case-sensitive for username", async () => {
    const result = await validateCredentials("Admin", "kb65");
    expect(result).toBe(false);
  });

  it("should be case-sensitive for password", async () => {
    const result = await validateCredentials("admin", "KB65");
    expect(result).toBe(false);
  });
});

describe("createToken and verifyToken", () => {
  it("should create a token that verifies successfully", async () => {
    const token = await createToken("admin");
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    const username = await verifyToken(token);
    expect(username).toBe("admin");
  });

  it("should create unique tokens", async () => {
    const token1 = await createToken("admin");
    const token2 = await createToken("admin");
    expect(token1).not.toBe(token2);
  });

  it("should reject invalid token", async () => {
    const username = await verifyToken("invalid-token-string");
    expect(username).toBeNull();
  });

  it("should reject empty token", async () => {
    const username = await verifyToken("");
    expect(username).toBeNull();
  });

  it("should reject a token that was never created", async () => {
    const username = await verifyToken("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.fake");
    expect(username).toBeNull();
  });

  it("should accept the same token multiple times (not single-use)", async () => {
    const token = await createToken("admin");
    expect(await verifyToken(token)).toBe("admin");
    expect(await verifyToken(token)).toBe("admin");
    expect(await verifyToken(token)).toBe("admin");
  });
});