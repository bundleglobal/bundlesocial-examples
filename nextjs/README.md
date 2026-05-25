# bundle.social — Next.js App Router example

A small Next.js 15 (App Router, React 19, TypeScript) app that shows the
three integration patterns most fullstack developers reach for first when
wiring the [`bundlesocial`](https://www.npmjs.com/package/bundlesocial)
Node SDK into a frontend codebase.

## What's in here

| Pattern | Where |
| --- | --- |
| **Compose & post** — upload a file then publish to X / Bluesky / LinkedIn via a server action driven by React's `useActionState`. | [`app/page.tsx`](./app/page.tsx) + [`app/compose-form.tsx`](./app/compose-form.tsx) + [`app/actions.ts`](./app/actions.ts) |
| **Connect a social account** — generate a hosted-portal URL with `socialAccount.socialAccountCreatePortalLink`, redirect the browser, then list the team's connected `socialAccounts` after redirect-back. | [`app/connect/page.tsx`](./app/connect/page.tsx) + [`app/connect/connect-buttons.tsx`](./app/connect/connect-buttons.tsx) |
| **Webhook receiver** — verify the `x-signature` header with `bundlesocial.webhooks.constructEvent` and log the typed event. | [`app/api/webhook/route.ts`](./app/api/webhook/route.ts) |

A thin [`lib/bundle.ts`](./lib/bundle.ts) instantiates the SDK client once
and exposes a `getTeamId()` helper that falls back to the first team on the
organization when `BUNDLESOCIAL_TEAM_ID` isn't set. The client is in a
`server-only` module so the API key cannot leak into a client bundle.

## Setup

```bash
pnpm install     # or `npm install`
cp .env.example .env
# fill in BUNDLESOCIAL_API_KEY and BUNDLESOCIAL_WEBHOOK_SECRET
pnpm dev
```

App boots on <http://localhost:3000>.

### Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `BUNDLESOCIAL_API_KEY` | yes | Found in the bundle.social dashboard under **Settings → API Keys**. |
| `BUNDLESOCIAL_TEAM_ID` | no | Skip it and the example resolves the first team via `team.teamGetList`. Useful for single-team accounts. |
| `BUNDLESOCIAL_WEBHOOK_SECRET` | yes (for `/api/webhook`) | The signing secret shown next to the webhook URL in the dashboard. |
| `NEXT_PUBLIC_APP_URL` | no | Used as the `redirectUrl` after the hosted portal flow. Defaults to `http://localhost:3000`. |

## Testing each path

### Compose & post (`/`)
1. Open `http://localhost:3000`.
2. Type some text, optionally attach an image, leave the default platform
   checkboxes (X / Bluesky / LinkedIn).
3. Submit. The page shows the returned post id, status, and upload id.

You need at least one connected social account of each platform you tick.
Connect them via `/connect` first (or skip them in the form).

### Connect a social account (`/connect`)
1. Open `http://localhost:3000/connect`.
2. Click **Connect TikTok** or **Connect Instagram**.
3. You'll be redirected to the bundle.social hosted portal to finish the
   OAuth-style flow, then redirected back here. The list of currently
   connected accounts on the team is re-fetched on each visit.

### Webhook receiver (`/api/webhook`)
Verifying signatures means we can't just `curl -X POST` with arbitrary
JSON — the body has to match the HMAC-SHA256 digest. Two ways to test:

- **Easiest**: in the bundle.social dashboard, point a webhook at
  `https://<your-tunnel>/api/webhook` (use `ngrok http 3000` or similar)
  and trigger an event (publish a post, connect an account). The
  Next.js server logs each event.
- **Manually**, signing the body yourself:
  ```bash
  BODY='{"type":"team.updated","data":{"id":"team_demo"}}'
  SIG=$(node -e "console.log(require('crypto').createHmac('sha256', process.env.BUNDLESOCIAL_WEBHOOK_SECRET).update(process.env.BODY).digest('hex'))" BODY="$BODY")
  curl -sS -X POST http://localhost:3000/api/webhook \
    -H "Content-Type: application/json" \
    -H "x-signature: $SIG" \
    -d "$BODY"
  ```
  A correctly signed request returns `{"received":true}`; a missing or
  wrong signature returns a 400.

## Verify the build

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm build
```

## References

- SDK on npm: <https://www.npmjs.com/package/bundlesocial>
- API docs: <https://docs.bundle.social>
- Platform-specific post field reference: <https://docs.bundle.social/api-reference/platform-parameters>
- Sibling Express example for comparison: [`../express`](../express)

## What this example deliberately skips

- No database, auth, or session — connecting an account assumes a single
  team per API key.
- Post fields are kept minimal (`text` + `uploadIds`). Each platform
  supports a lot more (`replySettings`, `boardName`, `topicType`, alt
  text, etc.) — see the docs link above.
- No retries / queue. `postCreate` runs inline in the server action.
