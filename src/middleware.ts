import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

// Protect everything except the login page, the login API, and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login|api/cron).*)"],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = await verifyToken(token);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
