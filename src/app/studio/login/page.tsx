"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";

const initialState: { error?: string } = {};

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/studio";
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      return (await login(formData)) ?? {};
    },
    initialState
  );

  return (
    <form action={formAction} className="studio-login__card">
      <p className="studio-login__eyebrow">LUÂN / STUDIO</p>
      <h1>Private workspace</h1>
      <p className="studio-login__hint">Sign in to manage blog posts and learning content.</p>

      <input type="hidden" name="from" value={from} />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
      />

      {state?.error && (
        <p className="studio-login__error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function StudioLoginPage() {
  return (
    <div className="studio-login">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
