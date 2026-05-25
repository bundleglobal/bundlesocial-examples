# bundle.social — scheduled posting example

A tiny TypeScript script that posts to [bundle.social](https://bundle.social)
from a one-shot run. Designed for `cron`, GitHub Actions, or any
serverless / scheduled platform. No server, no UI, no webhook handling.

```
scheduled/
├── scripts/
│   └── schedule-post.ts        # the CLI (~250 LoC, single file)
├── posts/
│   └── example.yaml            # sample post config
└── .github/workflows/
    └── post.yml                # cron + release-triggered runs
```

## What this example shows

- Driving the bundle.social SDK (`bundlesocial`) from a single-shot Node
  script — the lowest-overhead way to automate posting.
- Two scheduling surfaces:
  - **Cron** (every Monday 09:00 UTC) for recurring posts.
  - **`release: published`** for announcing GitHub releases automatically.
- Reading a post from a config file (`--config posts/example.yaml`) **or**
  from CLI flags (`--text`, `--platform`, `--media-url`, `--date`).
- Uploading media by URL (`upload.uploadCreateFromUrl`) before attaching
  it to the post.

Compared to the [`express/`](../express) example, there is no HTTP
listener, no webhook signature verification, and no persistent state —
just a single script run that exits non-zero on failure with a structured
JSON error.

## Local usage

```bash
pnpm install
export BUNDLESOCIAL_API_KEY=blds_...

# 1. From the example config file
pnpm tsx scripts/schedule-post.ts --config posts/example.yaml

# 2. From CLI flags
pnpm tsx scripts/schedule-post.ts \
  --text "Hello from a script!" \
  --platform x \
  --platform bluesky

# 3. With media + future scheduling
pnpm tsx scripts/schedule-post.ts \
  --text "Launch day!" \
  --platform x --platform linkedin \
  --media-url https://example.com/banner.png \
  --date 2026-06-01T09:00:00Z

# Smoke test (no API key needed)
pnpm tsx scripts/schedule-post.ts --help
```

The team id is auto-resolved via `organization.organizationGetOrganization`
when there is a single team on the organization. Set
`BUNDLESOCIAL_TEAM_ID` if you have several teams.

On success the script prints JSON to stdout:

```json
{
  "id": "post_…",
  "status": "SCHEDULED",
  "postDate": "2026-06-01T09:00:00.000Z",
  "platforms": ["TWITTER", "BLUESKY"],
  "teamId": "team_…",
  "uploadIds": ["upload_…"]
}
```

On failure it prints `{"error": {"code": "...", "message": "..."}}` on
stderr and exits non-zero. `bundlesocial` `ApiError` responses surface
the `status`, `statusText`, `url` and response `body` under
`error.details`.

### Config file shape

`posts/example.yaml` (YAML or JSON both work):

```yaml
text: "Hello from a scheduled GitHub Action!"
platforms: [x, bluesky]   # aliases ok; mapped to TWITTER, BLUESKY
mediaUrl: https://example.com/banner.png   # optional
date: 2026-06-01T09:00:00Z                 # optional, schedules the post
title: "Weekly heartbeat"                  # optional
```

Supported platform aliases mirror the
[`bundlesocial-cli`](../../bundlesocial-cli/src/platforms.ts) list:
`x`/`twitter`, `bsky`/`bluesky`, `tt`/`tiktok`, `ig`/`instagram`,
`fb`/`facebook`, `yt`/`youtube`, `li`/`linkedin`, `gbp`/`google_business`,
plus `threads`, `pinterest`, `reddit`, `mastodon`, `discord`, `slack`.

## GitHub Actions setup

1. Copy this whole `scheduled/` directory into your repo (the workflow
   assumes the path `scheduled/`; change `working-directory` in
   `.github/workflows/post.yml` if you mount it elsewhere).
2. In **Settings → Secrets and variables → Actions**, add:
   - `BUNDLESOCIAL_API_KEY` — required.
   - `BUNDLESOCIAL_TEAM_ID` — optional, only needed if your organization
     has more than one team.
3. Commit and push. The workflow has three triggers:

| Trigger | When | What it posts |
| --- | --- | --- |
| `schedule` (cron) | Every Monday at 09:00 UTC | The contents of `posts/example.yaml` |
| `release: published` | Each time you publish a GitHub release | `🚀 New release: <name> — <url>` to X / Bluesky / LinkedIn |
| `workflow_dispatch` | Manually from the Actions tab | Either the YAML config or the `text` input you provide |

### Customizing the cron

The cron line lives in `.github/workflows/post.yml`:

```yaml
- cron: "0 9 * * 1"   # Mon 09:00 UTC
```

GitHub Actions runs crons in UTC and may delay them by a few minutes
under load. Use [crontab.guru](https://crontab.guru) to pick a different
expression — e.g. `0 14 * * *` for every day at 14:00 UTC.

### Testing the release path

You don't need to cut a real release to test the workflow:

1. Trigger the workflow from the **Actions** tab using the
   `workflow_dispatch` trigger, with a custom `text` input.
2. Or publish a draft release to a test repo with `BUNDLESOCIAL_API_KEY`
   pointing at a sandbox team.

You can also dry-run the exact command locally:

```bash
RELEASE_NAME="v1.2.3" \
RELEASE_URL="https://github.com/you/repo/releases/tag/v1.2.3" \
pnpm tsx scripts/schedule-post.ts \
  --text "🚀 New release: ${RELEASE_NAME} — ${RELEASE_URL}" \
  --title "Release: ${RELEASE_NAME}" \
  --platform x --platform bluesky --platform linkedin
```

## Trade-offs vs. the other examples

| Concern | `scheduled/` (this) | [`express/`](../express) | Next.js example |
| --- | --- | --- | --- |
| Hosting | None — runs in CI / cron | Long-lived HTTP server | Vercel / Node server |
| Triggers | Cron, release, manual dispatch | Any HTTP request | User-driven via UI |
| Webhooks | Not handled — no `post.published` callbacks | Verified inline | Verified inline |
| State | None — every run is fresh | In-memory `teamId` etc. | Persistent app state |
| Best for | Recurring posts, release notes, batch jobs | API exploration, webhooks | User-facing apps |

If you need to react to `post.published` / `post.failed` events, pair
this script with the Express example (or any HTTP endpoint) that
verifies `x-signature` against your `BUNDLESOCIAL_WEBHOOK_SECRET`.
