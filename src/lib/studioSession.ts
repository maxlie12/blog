import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";
import { isLearnerAuthConfigured } from "@/lib/learnerAuth";

// Not a secret: it is already the public git author address. Kept in code so production needs no extra env var.
export const STUDIO_OWNER_EMAIL = "hihop100nb200@gmail.com";

/** True when the visitor is signed in with Clerk under the owner's verified email. */
export async function isClerkStudioOwner(): Promise<boolean> {
  if (process.env.BLOG_READ_ONLY_PREVIEW === "1" || !isLearnerAuthConfigured()) return false;
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  return Boolean(user?.emailAddresses.some((email) =>
    email.emailAddress.toLowerCase() === STUDIO_OWNER_EMAIL && email.verification?.status === "verified"
  ));
}

/** True/false, non-redirecting — for public pages that behave differently when the owner is
 * signed in (e.g. showing an attempt-submission form) but must still render for everyone else. */
export async function hasStudioSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return (await isValidSessionToken(token)) || isClerkStudioOwner();
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
