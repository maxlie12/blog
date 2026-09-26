"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, checkPassword, createSessionToken } from "@/lib/auth";

export async function login(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/studio");

  if (!process.env.STUDIO_PASSWORD || !process.env.STUDIO_SESSION_SECRET) {
    return {
      error:
        "Studio auth isn't configured — set STUDIO_PASSWORD and STUDIO_SESSION_SECRET (see docs/OPERATIONS.md).",
    };
  }

  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  const { token, maxAge } = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  redirect(from.startsWith("/studio") ? from : "/studio");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/studio/login");
}
