"use client";

import { useActionState } from "react";
import { setStaffPassword } from "@/app/actions";

const initialState: { error?: string } = {};

// Reached from an invite or password-reset email after /auth/callback has
// already exchanged the link's code for a real session — this page runs
// as an authenticated staff member setting/changing their own password,
// not as part of the sign-in flow itself. Mirrors
// src/app/portal/set-password/page.tsx exactly, just for the staff side.
export default function SetStaffPasswordPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) =>
      setStaffPassword(formData),
    initialState
  );

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Set your password</h1>
        <p className="text-foreground/60 mt-1">
          Choose a password for signing in to Routed Ops from now on.
        </p>
      </div>

      <form
        action={formAction}
        className="rounded-lg border border-border bg-white p-5 space-y-4"
      >
        <label className="block text-sm">
          <span className="block text-foreground/70 mb-1">
            New password
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-foreground/70 mb-1">
            Confirm password
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            placeholder="Re-enter password"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent text-white font-semibold py-2.5 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
