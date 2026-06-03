// Edge-compatible auth helpers using the Web Crypto API so they work in both
// middleware (edge runtime) and route handlers (node runtime).

export const AUTH_COOKIE = "carcost_auth";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return secret;
}

async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The token is a stable HMAC over a fixed payload. Anyone without AUTH_SECRET
// cannot forge it, and it only changes if you rotate the secret.
export async function createToken(): Promise<string> {
  return hmac("carcost-authenticated");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await createToken();
  return timingSafeEqual(token, expected);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD is not set.");
  }
  if (input.length !== expected.length) return false;
  return timingSafeEqual(input, expected);
}
