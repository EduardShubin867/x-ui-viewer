import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/api/collector/events", "/api/collector/metrics", "/api/health"];

export function proxy(request: NextRequest): NextResponse {
  if (publicPaths.includes(request.nextUrl.pathname)) return NextResponse.next();
  const username = process.env.PANEL_USERNAME;
  const password = process.env.PANEL_PASSWORD;
  if (!username || !password) return new NextResponse("Panel credentials are not configured", { status: 503 });
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  if (request.headers.get("authorization") === expected) return NextResponse.next();
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Xray Scope", charset="UTF-8"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
