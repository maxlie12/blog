import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

/** True/false, non-redirecting — for public pages that behave differently when the owner is
 * signed in (e.g. showing an attempt-submission form) but must still render for everyone else. */
export async function hasStudioSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return isValidSessionToken(token);
}

/**
 * Defense-in-depth check for Server Actions and Server Components under /studio.
 * Middleware already gates page navigations, but a Server Action can in principle be invoked
 * directly, so every mutation re-checks the session here rather than trusting the middleware
 * alone.
 */
export async function requireStudioSession(): Promise<void> {
  const valid = await hasStudioSession();
  if (!valid) redirect("/studio/login");
}
