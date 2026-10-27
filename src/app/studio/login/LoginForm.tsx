"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState: { error?: string } = {};

export function LoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      return (await login(formData)) ?? {};
    },
    initialState
  );

  return (
    <form action={formAction} className="studio-login__form">
      <input type="hidden" name="from" value={from} />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      {state?.error && (
        <p className="studio-login__error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in with password"}
      </button>
    </form>
  );
}
