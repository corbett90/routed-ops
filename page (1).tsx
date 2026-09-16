"use client";

import { useState, useActionState } from "react";
import { signInStaff, requestStaffPasswordReset } from "@/app/actions";

const signInInitial: { error?: string } = {};
const resetInitial: { error?: string; sent?: boolean } = {};

export default function StaffLoginPage() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");

  const [signInState, signInAction, signInPending] = useActionState(
    async (_prev: typeof signInInitial, formData: FormData) =>
      signInStaff(formData),
    signInInitial
  );

  const [resetState, resetAction, resetPending] = useActionState(
    async (_prev: typeof resetInitial, formData: FormData) =>
      requestStaffPasswordReset(formData),
    resetInitial
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-accent">Routed Ops</h1>
          <p className="text-foreground/60 mt-1">Staff sign in.</p>
        </div>

        {mode === "signin" && (
          <form
            action={signInAction}
            className="rounded-lg border border-border bg-white p-5 space-y-4"
          >
            <label className="block text-sm">
              <span className="block text-foreground/70 mb-1">
                Email address
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@routedparts.com"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-foreground/70 mb-1">Password</span>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            {signInState.error && (
              <p className="text-sm text-red-600">{signInState.error}</p>
            )}
            <button
              type="submit"
              disabled={signInPending}
              className="w-full rounded-md bg-accent text-white font-semibold py-2.5 disabled:opacity-40"
            >
              {signInPending ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="w-full text-center text-xs text-foreground/50 hover:text-accent"
            >
              Forgot password?
            </button>
          </form>
        )}

        {mode === "reset" && !resetState.sent && (
          <form
            action={resetAction}
            className="rounded-lg border border-border bg-white p-5 space-y-4"
          >
            <label className="block text-sm">
              <span className="block text-foreground/70 mb-1">
                Email address
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@routedparts.com"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            {resetState.error && (
              <p className="text-sm text-red-600">{resetState.error}</p>
            )}
            <button
              type="submit"
              disabled={resetPending}
              className="w-full rounded-md bg-accent text-white font-semibold py-2.5 disabled:opacity-40"
            >
              {resetPending ? "Sending…" : "Email me a reset link"}
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-xs text-foreground/50 hover:text-accent"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "reset" && resetState.sent && (
          <div className="rounded-lg border border-border bg-white p-5 text-center space-y-2">
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-foreground/60">
              We sent a password reset link. Open it on this device to
              continue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
