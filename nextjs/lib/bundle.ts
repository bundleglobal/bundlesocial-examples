import "server-only";
import { Bundlesocial } from "bundlesocial";

/**
 * Singleton bundle.social client. Kept in a server-only module so the API key
 * never leaks into a client bundle. Import this from server components,
 * server actions, and route handlers only.
 */

const apiKey = process.env.BUNDLESOCIAL_API_KEY;

if (!apiKey) {
  // Throwing at import time gives a loud failure during `next build` / boot
  // rather than a confusing 500 the first time a request hits the SDK.
  throw new Error(
    "BUNDLESOCIAL_API_KEY is not set. Copy .env.example to .env and fill it in."
  );
}

export const bundlesocial = new Bundlesocial(apiKey);

/**
 * Resolve the team id to use for SDK calls.
 *
 * If `BUNDLESOCIAL_TEAM_ID` is set we trust it. Otherwise we fetch the first
 * team on the organization — convenient for single-team accounts and demos.
 */
export async function getTeamId(): Promise<string> {
  const fromEnv = process.env.BUNDLESOCIAL_TEAM_ID;
  if (fromEnv) return fromEnv;

  const teams = await bundlesocial.team.teamGetList({ limit: 1, offset: 0 });
  const first = teams.items[0];
  if (!first) {
    throw new Error(
      "No teams found on this organization. Create one in the bundle.social dashboard or set BUNDLESOCIAL_TEAM_ID."
    );
  }
  return first.id;
}
