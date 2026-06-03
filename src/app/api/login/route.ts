import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, checkPassword, createToken } from "@/lib/auth";
import { clientIp, checkLock, recordFailure, clearFailures } from "@/lib/login-throttle";

function back(req: NextRequest, params: string) {
  return NextResponse.redirect(new URL(`/login${params}`, req.url), { status: 303 });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Refuse early if this IP is in a lockout window — don't even check the password.
  const lock = await checkLock(ip);
  if (lock.locked) {
    return back(req, `?error=locked&min=${lock.retryAfterMin}`);
  }

  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  if (!checkPassword(password)) {
    const state = await recordFailure(ip);
    // Small delay slows automated guessing before lockout kicks in.
    await new Promise((r) => setTimeout(r, 400));
    if (state.locked) {
      return back(req, `?error=locked&min=${state.retryAfterMin}`);
    }
    return back(req, "?error=1");
  }

  await clearFailures(ip);

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  const token = await createToken();
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
