import { NextRequest, NextResponse } from "next/server";

// Basic auth on the dashboard only. Webhooks authenticate with their own secrets.
export const config = { matcher: ["/((?!api/).*)"] };

export function middleware(req: NextRequest) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) return NextResponse.next();
  const auth = req.headers.get("authorization") ?? "";
  const [, b64] = auth.split(" ");
  const [user, pwd] = b64 ? atob(b64).split(":") : [];
  if (user === "aangan" && pwd === pass) return NextResponse.next();
  return new NextResponse("Sign in required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan dashboard"' },
  });
}
