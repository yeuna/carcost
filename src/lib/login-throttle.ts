import { eq } from "drizzle-orm";
import { db } from "./db";
import { loginThrottle } from "./schema";

// Brute-force lockout policy (the serverless equivalent of fail2ban).
const MAX_FAILS = 5; // attempts allowed within the window before lockout
const WINDOW_MS = 15 * 60 * 1000; // failures older than this don't count
const LOCK_MS = 15 * 60 * 1000; // how long an IP stays locked out

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface LockState {
  locked: boolean;
  retryAfterMin: number;
}

// Returns whether this IP is currently locked out (call before checking password).
export async function checkLock(ip: string): Promise<LockState> {
  const [row] = await db.select().from(loginThrottle).where(eq(loginThrottle.ip, ip)).limit(1);
  if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    return {
      locked: true,
      retryAfterMin: Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60000),
    };
  }
  return { locked: false, retryAfterMin: 0 };
}

// Record a failed attempt; locks the IP once it crosses MAX_FAILS in the window.
export async function recordFailure(ip: string): Promise<LockState> {
  const now = Date.now();
  const [row] = await db.select().from(loginThrottle).where(eq(loginThrottle.ip, ip)).limit(1);

  // Reset the counter if the last failure was outside the sliding window.
  const withinWindow = row && now - row.updatedAt.getTime() < WINDOW_MS;
  const fails = withinWindow ? row.fails + 1 : 1;
  const lockedUntil = fails >= MAX_FAILS ? new Date(now + LOCK_MS) : null;
  const updatedAt = new Date(now);

  await db
    .insert(loginThrottle)
    .values({ ip, fails, lockedUntil, updatedAt })
    .onConflictDoUpdate({
      target: loginThrottle.ip,
      set: { fails, lockedUntil, updatedAt },
    });

  return {
    locked: lockedUntil != null,
    retryAfterMin: lockedUntil ? Math.ceil(LOCK_MS / 60000) : 0,
  };
}

// Clear the record on a successful login.
export async function clearFailures(ip: string): Promise<void> {
  await db.delete(loginThrottle).where(eq(loginThrottle.ip, ip));
}
