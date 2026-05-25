"use client";

import { useActionState } from "react";
import { composeAndPost, type ComposeResult } from "./actions";

const PLATFORMS = [
  { key: "TWITTER", label: "X (Twitter)" },
  { key: "BLUESKY", label: "Bluesky" },
  { key: "LINKEDIN", label: "LinkedIn" },
] as const;

export function ComposeForm() {
  const [state, formAction, pending] = useActionState<ComposeResult | null, FormData>(
    composeAndPost,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="text" className="mb-1 block text-sm font-medium">
          Post text
        </label>
        <textarea
          id="text"
          name="text"
          rows={4}
          required
          placeholder="Hello from bundle.social 👋"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div>
        <label htmlFor="image" className="mb-1 block text-sm font-medium">
          Image (optional)
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800 dark:file:bg-neutral-200 dark:file:text-neutral-900"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Publish to</legend>
        <div className="flex flex-wrap gap-4">
          {PLATFORMS.map((p) => (
            <label key={p.key} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`platform_${p.key}`}
                defaultChecked
                className="h-4 w-4 rounded border-neutral-300"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        {pending ? "Publishing…" : "Publish now"}
      </button>

      {state && <ResultPanel state={state} />}
    </form>
  );
}

function ResultPanel({ state }: { state: ComposeResult }) {
  if (state.ok) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
        <p className="font-medium text-emerald-900 dark:text-emerald-200">
          Scheduled.
        </p>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 font-mono text-xs">
          <dt className="text-emerald-800/70 dark:text-emerald-300/70">post id</dt>
          <dd>{state.postId}</dd>
          <dt className="text-emerald-800/70 dark:text-emerald-300/70">status</dt>
          <dd>{state.status}</dd>
          {state.uploadId && (
            <>
              <dt className="text-emerald-800/70 dark:text-emerald-300/70">upload id</dt>
              <dd>{state.uploadId}</dd>
            </>
          )}
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950/40">
      <p className="font-medium text-red-900 dark:text-red-200">
        {state.error.code}
      </p>
      <p className="mt-1 text-red-800 dark:text-red-300">
        {state.error.message}
      </p>
    </div>
  );
}
