import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getAuthenticatedLearnerId, isLearnerAuthConfigured } from "@/lib/learnerAuth";
import { hasStudioSession } from "@/lib/studioSession";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function StudioLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const requested = (await searchParams).from;
  const from = requested?.startsWith("/studio") ? requested : "/studio";
  if (await hasStudioSession()) redirect(from);

  const clerkEnabled = isLearnerAuthConfigured();
  const passwordEnabled = Boolean(process.env.STUDIO_PASSWORD && process.env.STUDIO_SESSION_SECRET);
  const signedInAsOther = clerkEnabled && Boolean(await getAuthenticatedLearnerId());

  return (
    <div className="studio-login">
      <div className="studio-login__card">
        <p className="studio-login__eyebrow">LUÂN / STUDIO</p>
        <h1>Private workspace</h1>
        <p className="studio-login__hint">Sign in to manage blog posts and learning content.</p>

        {signedInAsOther && (
          <>
            <p className="studio-login__error" role="alert">
              This account can’t open Studio. Sign out, then sign in with the owner account.
            </p>
            <SignOutButton redirectUrl={`/studio/login?from=${encodeURIComponent(from)}`}>
              <button type="button" className="button button--primary">Sign out</button>
            </SignOutButton>
          </>
        )}

        {clerkEnabled && !signedInAsOther && (
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(from)}`} className="button button--primary">
            Sign in with your account
          </Link>
        )}

        {passwordEnabled && <LoginForm from={from} />}

        {!clerkEnabled && !passwordEnabled && (
          <p className="studio-login__error" role="alert">
            Studio sign-in isn’t configured. Set the Clerk keys or STUDIO_PASSWORD + STUDIO_SESSION_SECRET (see docs/OPERATIONS.md).
          </p>
        )}
      </div>
    </div>
  );
}
