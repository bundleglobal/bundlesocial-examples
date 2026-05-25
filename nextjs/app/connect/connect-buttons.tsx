"use client";

import { useTransition } from "react";
import { createConnectLink } from "../actions";

const PROVIDERS = [
  { type: "TIKTOK", label: "Connect TikTok" },
  { type: "INSTAGRAM", label: "Connect Instagram" },
] as const;

export function ConnectButtons() {
  const [pending, startTransition] = useTransition();

  function connect(type: "TIKTOK" | "INSTAGRAM") {
    startTransition(async () => {
      const result = await createConnectLink(type);
      if ("url" in result) {
        // Full-page navigate to bundle.social's hosted portal.
        window.location.href = result.url;
      } else {
        alert(`${result.error.code}: ${result.error.message}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.type}
          type="button"
          disabled={pending}
          onClick={() => connect(p.type)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {pending ? "Opening…" : p.label}
        </button>
      ))}
    </div>
  );
}
