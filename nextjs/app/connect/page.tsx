import { ApiError } from "bundlesocial";
import { bundlesocial, getTeamId } from "@/lib/bundle";
import { ConnectButtons } from "./connect-buttons";

// Disable static rendering — we want a fresh team snapshot on each visit,
// especially after redirect-back from the hosted portal.
export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  let socialAccounts:
    | Awaited<ReturnType<typeof bundlesocial.team.teamGetTeam>>["socialAccounts"]
    | null = null;
  let teamName = "";
  let errorMessage: string | null = null;

  try {
    const teamId = await getTeamId();
    const team = await bundlesocial.team.teamGetTeam({ id: teamId });
    teamName = team.name;
    socialAccounts = team.socialAccounts;
  } catch (err) {
    errorMessage =
      err instanceof ApiError
        ? `bundle.social API error (${err.status}): ${err.message}`
        : err instanceof Error
          ? err.message
          : "Failed to load team.";
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect a social account
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Buttons trigger a server action that returns a hosted portal URL via{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">
            socialAccount.socialAccountCreatePortalLink
          </code>
          . The browser is redirected there; bundle.social sends the user
          back to <code>/connect</code> when done.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Start a connection
        </h2>
        <ConnectButtons />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Current integrations {teamName && <span className="font-normal normal-case text-neutral-400">— {teamName}</span>}
        </h2>

        {errorMessage ? (
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950/40">
            {errorMessage}
          </div>
        ) : !socialAccounts || socialAccounts.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
            No accounts connected yet. Click a button above to start the
            hosted-portal flow.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {socialAccounts.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  {acc.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={acc.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <div>
                    <div className="font-medium">{acc.type}</div>
                    <div className="text-xs text-neutral-500">
                      {acc.displayName ?? acc.username ?? acc.id}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-neutral-400">
                  {acc.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
