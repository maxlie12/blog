import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

async function routeRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/studio") || pathname === "/studio/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/studio/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
);
const withLearnerAuth = authConfigured ? clerkMiddleware((_auth, request) => routeRequest(request)) : null;

export default function proxy(request: NextRequest, event: Parameters<NonNullable<typeof withLearnerAuth>>[1]) {
  return withLearnerAuth ? withLearnerAuth(request, event) : routeRequest(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
