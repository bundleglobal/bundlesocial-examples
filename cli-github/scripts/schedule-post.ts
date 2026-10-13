#!/usr/bin/env tsx
/**
 * One-shot CLI that creates a post on bundle.social.
 *
 * Designed to be run from cron, a GitHub Actions workflow, or any
 * scheduled / serverless platform — no server, no UI, no webhooks.
 *
 * Usage:
 *   pnpm tsx scripts/schedule-post.ts --config posts/example.yaml
 *   pnpm tsx scripts/schedule-post.ts \
 *     --text "Hello" --platform x --platform bluesky \
 *     --media-url https://example.com/banner.png \
 *     --date 2026-06-01T09:00:00Z
 *
 * Env:
 *   BUNDLESOCIAL_API_KEY   (required) API key from https://bundle.social
 *   BUNDLESOCIAL_TEAM_ID   (optional) team id; auto-resolved when omitted
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Command, Option } from "commander";
import yaml from "js-yaml";
import { ApiError, Bundlesocial } from "bundlesocial";

const PLATFORMS = [
  "TIKTOK",
  "YOUTUBE",
  "INSTAGRAM",
  "FACEBOOK",
  "TWITTER",
  "THREADS",
  "LINKEDIN",
  "PINTEREST",
  "REDDIT",
  "MASTODON",
  "DISCORD",
  "SLACK",
  "BLUESKY",
  "GOOGLE_BUSINESS",
] as const;
type Platform = (typeof PLATFORMS)[number];

// Minimal alias map — copied from the canonical list in
// ../../bundlesocial-cli/src/platforms.ts.
const ALIASES: Record<string, Platform> = {
  X: "TWITTER",
  TWITTER: "TWITTER",
  TIKTOK: "TIKTOK",
  TT: "TIKTOK",
  YOUTUBE: "YOUTUBE",
  YT: "YOUTUBE",
  INSTAGRAM: "INSTAGRAM",
  IG: "INSTAGRAM",
  FACEBOOK: "FACEBOOK",
  FB: "FACEBOOK",
  THREADS: "THREADS",
  LINKEDIN: "LINKEDIN",
  LI: "LINKEDIN",
  PINTEREST: "PINTEREST",
  REDDIT: "REDDIT",
  MASTODON: "MASTODON",
  DISCORD: "DISCORD",
  SLACK: "SLACK",
  BLUESKY: "BLUESKY",
  BSKY: "BLUESKY",
  GOOGLE_BUSINESS: "GOOGLE_BUSINESS",
  GBP: "GOOGLE_BUSINESS",
};

function normalizePlatform(input: string): Platform {
  const key = input.trim().toUpperCase().replace(/\s+/g, "_");
  const platform = ALIASES[key];
  if (!platform) {
    throw new ScheduledPostError(
      "UNKNOWN_PLATFORM",
      `Unknown platform "${input}". Supported: ${PLATFORMS.join(", ")} (aliases like "x", "bsky", "gbp" too).`,
    );
  }
  return platform;
}

interface PostConfig {
  text: string;
  platforms: Platform[];
  mediaUrl?: string;
  date?: string;
  title?: string;
}

class ScheduledPostError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ScheduledPostError";
  }
}

function readConfigFile(path: string): Partial<PostConfig> {
  const absolute = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absolute, "utf8");
  } catch (error) {
    throw new ScheduledPostError(
      "CONFIG_NOT_FOUND",
      `Could not read --config file: ${absolute}`,
      { cause: (error as Error).message },
    );
  }

  let parsed: unknown;
  try {
    parsed = absolute.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
  } catch (error) {
    throw new ScheduledPostError(
      "CONFIG_INVALID",
      `Could not parse config file ${absolute}: ${(error as Error).message}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ScheduledPostError(
      "CONFIG_INVALID",
      `Config file ${absolute} must be a YAML or JSON object.`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const config: Partial<PostConfig> = {};
  if (typeof obj.text === "string") config.text = obj.text;
  if (Array.isArray(obj.platforms)) {
    config.platforms = obj.platforms.map((p) => normalizePlatform(String(p)));
  }
  if (typeof obj.mediaUrl === "string") config.mediaUrl = obj.mediaUrl;
  if (typeof obj.date === "string") config.date = obj.date;
  if (typeof obj.title === "string") config.title = obj.title;
  return config;
}

function toIsoDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ScheduledPostError(
      "INVALID_DATE",
      `--date is not a valid ISO 8601 timestamp: "${value}". Example: 2026-06-01T09:00:00Z`,
    );
  }
  return date.toISOString();
}

function deriveTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (!firstLine) return "Scheduled post";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

async function resolveTeamId(client: Bundlesocial): Promise<string> {
  if (process.env.BUNDLESOCIAL_TEAM_ID) return process.env.BUNDLESOCIAL_TEAM_ID;
  // Two is enough to tell "none / exactly one / several" apart; `total` gives the real count.
  const { items: teams, total } = await client.team.teamGetList({ offset: 0, limit: 2 });
  if (total === 0) {
    throw new ScheduledPostError(
      "NO_TEAM",
      "Organization has no teams. Create one in the bundle.social dashboard or pass BUNDLESOCIAL_TEAM_ID.",
    );
  }
  if (total > 1) {
    throw new ScheduledPostError(
      "AMBIGUOUS_TEAM",
      "Organization has multiple teams; set BUNDLESOCIAL_TEAM_ID to disambiguate.",
      { teams: teams.map((t) => ({ id: t.id, name: t.name })) },
    );
  }
  return teams[0].id;
}

interface CliOptions {
  config?: string;
  text?: string;
  platform?: string[];
  mediaUrl?: string;
  date?: string;
  title?: string;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("schedule-post")
    .description("Create a bundle.social post from a one-shot script (cron / GitHub Actions friendly).")
    .option("-c, --config <path>", "YAML or JSON file with post config (text, platforms, mediaUrl, date)")
    .option("-t, --text <text>", "Post body (overrides --config)")
    .option("-p, --platform <name...>", "Target platform — repeatable. Accepts aliases like x, bsky, gbp.")
    .option("-m, --media-url <url>", "Public URL to image/video; uploaded via uploadCreateFromUrl")
    .option("-d, --date <iso>", "ISO-8601 timestamp; schedules the post for the future (status=SCHEDULED)")
    .option("--title <title>", "Post title shown in the dashboard (defaults to first line of text)")
    .addOption(
      new Option("--api-key <key>", "Override BUNDLESOCIAL_API_KEY for this run").hideHelp(),
    )
    .showHelpAfterError();

  program.parse(process.argv);
  const opts = program.opts<CliOptions>();

  // Merge config file + CLI flags. CLI flags win.
  const fromFile = opts.config ? readConfigFile(opts.config) : {};
  const text = opts.text ?? fromFile.text;
  const platformsRaw = opts.platform ?? [];
  const platforms: Platform[] =
    platformsRaw.length > 0 ? platformsRaw.map(normalizePlatform) : fromFile.platforms ?? [];
  const mediaUrl = opts.mediaUrl ?? fromFile.mediaUrl;
  const dateRaw = opts.date ?? fromFile.date;
  const title = opts.title ?? fromFile.title ?? deriveTitle(text ?? "");

  if (!text) {
    throw new ScheduledPostError("MISSING_TEXT", "No post text. Provide --text or set `text:` in --config.");
  }
  if (platforms.length === 0) {
    throw new ScheduledPostError(
      "MISSING_PLATFORMS",
      "No target platforms. Pass --platform (repeatable) or set `platforms:` in --config.",
    );
  }
  const dedupedPlatforms = Array.from(new Set(platforms));

  const apiKey = (opts as { apiKey?: string }).apiKey ?? process.env.BUNDLESOCIAL_API_KEY;
  if (!apiKey) {
    throw new ScheduledPostError(
      "MISSING_API_KEY",
      "BUNDLESOCIAL_API_KEY is required. Set it in the environment or pass --api-key.",
    );
  }

  const client = new Bundlesocial(apiKey);
  const teamId = await resolveTeamId(client);

  let uploadIds: string[] = [];
  if (mediaUrl) {
    const upload = await client.upload.uploadCreateFromUrl({
      requestBody: { teamId, url: mediaUrl },
    });
    uploadIds = [upload.id];
  }

  const data: Record<string, { text: string; uploadIds?: string[] }> = {};
  for (const platform of dedupedPlatforms) {
    data[platform] = {
      text,
      ...(uploadIds.length > 0 ? { uploadIds } : {}),
    };
  }

  const scheduled = Boolean(dateRaw);
  const postDate = scheduled ? toIsoDate(dateRaw!) : new Date().toISOString();
  const post = await client.post.postCreate({
    requestBody: {
      teamId,
      title,
      status: scheduled ? "SCHEDULED" : "DRAFT",
      postDate,
      socialAccountTypes: dedupedPlatforms,
      data,
    },
  });

  process.stdout.write(
    JSON.stringify(
      {
        id: post.id,
        status: post.status,
        postDate: post.postDate ?? null,
        platforms: dedupedPlatforms,
        teamId,
        uploadIds,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error: unknown) => {
  let envelope: { code: string; message: string; details?: unknown };
  if (error instanceof ScheduledPostError) {
    envelope = { code: error.code, message: error.message, details: error.details };
  } else if (error instanceof ApiError) {
    envelope = {
      code: "BUNDLESOCIAL_API_ERROR",
      message: error.message,
      details: {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        body: error.body,
      },
    };
  } else if (error instanceof Error) {
    envelope = { code: "UNEXPECTED_ERROR", message: error.message };
  } else {
    envelope = { code: "UNEXPECTED_ERROR", message: String(error) };
  }
  process.stderr.write(JSON.stringify({ error: envelope }, null, 2) + "\n");
  process.exit(1);
});
