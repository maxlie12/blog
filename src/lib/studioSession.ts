import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

/**
 * Defense-in-depth check for Server Actions and Server Components under /studio.
 * Middleware already gates page navigations, but a Server Action can in principle be invoked
 * directly, so every mutation re-checks the session here rather than trusting the middleware
 * alone.
 */
export async function requireStudioSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const valid = await isValidSessionToken(token);
  if (!valid) redirect("/studio/login");
}
