"use client";

import { useActionState } from "react";
import { requestPortalMagicLink } from "@/app/actions";

const initialState: { error?: string; sent?: boolean } = {};

export default function PortalLoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) =>
      requestPortalMagicLink(formData),
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-accent">Routed</h1>
          <p className="text-foreground/60 mt-1">
            Sign in to see your store&apos;s deliveries.
          </p>
        </div>

        {state.sent ? (
          <div className="rounded-lg border border-border bg-white p-5 text-center space-y-2">
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-foreground/60">
              We sent a sign-in link. Open it on this device to continue.
            </p>
          </div>
        ) : (
          <form action={formAction} className="rounded-lg border border-border bg-white p-5 space-y-4">
            <label className="block text-sm">
              <span className="block text-foreground/70 mb-1">Email address</span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@yourstore.com"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            {state.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-accent text-white font-semibold py-2.5 disabled:opacity-40"
            >
              {pending ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
