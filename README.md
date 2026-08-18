# bundle.social API Examples: TypeScript, Python, Next.js, MCP and Make

Runnable examples for building with the [bundle.social](https://bundle.social) unified social media API.

Use this repository to connect social accounts, publish and schedule content, process webhooks, retrieve analytics, and add social media workflows to SaaS products, internal tools, AI agents, and automations.

## Quick links

- [Website](https://bundle.social)
- [Documentation](https://info.bundle.social/welcome)
- [API introduction](https://info.bundle.social/api-reference/introduction)
- [Examples documentation](https://info.bundle.social/api-reference/examples)
- [OpenAPI specification](https://info.bundle.social/api-reference/openapi)
- [Node.js SDK](https://info.bundle.social/api-reference/sdk)
- [CLI](https://info.bundle.social/api-reference/cli)
- [MCP server](https://info.bundle.social/api-reference/mcp)
- [Postman workspace](https://www.postman.com/bundlesocial/workspace/bundle-social-api/overview)
- [Service status](https://bundlesocial.betteruptime.com)

## What you can build

- A multi-tenant social media scheduler for a SaaS application
- Cross-platform publishing and content automation
- Social account connection flows using OAuth
- Analytics dashboards with normalized social metrics
- Webhook-driven post status and event processing
- AI-agent workflows using MCP
- No-code and low-code automations

## Examples in this repository

| Example | Best for | What it demonstrates |
|---|---|---|
| [`cli-github/`](./cli-github) | CI/CD and developer automation | Using bundle.social tooling in GitHub-oriented workflows |
| [`express/`](./express) | Node.js backends | A server-side integration built with Express |
| [`make.com/tiktok/`](./make.com/tiktok) | No-code automation | A TikTok workflow built with Make |
| [`mcp-agent/`](./mcp-agent) | AI agents | Connecting an agent to social media capabilities through MCP |
| [`nextjs/`](./nextjs) | SaaS and web applications | A full-stack integration using Next.js |
| [`python/`](./python) | Scripts and backend jobs | Calling the bundle.social API from Python |

Choose the example closest to your runtime and use case. Each directory is independent, so its dependencies and setup steps may differ.

## Prerequisites

Before running an example, you will usually need:

1. A [bundle.social account](https://bundle.social).
2. An API key created in your dashboard.
3. A team identifier.
4. At least one connected social account for end-to-end publishing tests.
5. The runtime required by the selected example, such as Node.js or Python.

Never expose a bundle.social API key in client-side code or commit it to Git.

## Quick start

Clone the repository:

```bash
git clone https://github.com/bundleglobal/bundlesocial-examples.git
cd bundlesocial-examples
```

Open the directory for the example you want to run and follow the setup instructions and configuration used there.

For API exploration without a local project, open the [bundle.social Postman workspace](https://www.postman.com/bundlesocial/workspace/bundle-social-api/overview).

## REST API example: schedule a post

The API uses `https://api.bundle.social/api/v1` as its base URL and accepts the API key in the `x-api-key` header.

```ts
const postDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const response = await fetch("https://api.bundle.social/api/v1/post", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.BUNDLE_API_KEY!,
  },
  body: JSON.stringify({
    teamId: process.env.BUNDLE_TEAM_ID,
    title: "Scheduled from the bundle.social API",
    status: "SCHEDULED",
    postDate,
    socialAccountTypes: ["FACEBOOK", "INSTAGRAM"],
    data: {
      FACEBOOK: {
        type: "POST",
        text: "Scheduled from the bundle.social API",
        uploadIds: ["upload_image_123"],
      },
      INSTAGRAM: {
        type: "POST",
        text: "Scheduled from the bundle.social API",
        uploadIds: ["upload_image_123"],
        altText: "Product dashboard screenshot",
      },
    },
  }),
});

if (!response.ok) {
  throw new Error(`bundle.social request failed: ${response.status}`);
}

const post = await response.json();
console.log(post);
```

Use a future `postDate` and replace the team and upload identifiers with data from your own account. See [Create a post](https://info.bundle.social/api-reference/client/post/create-post) and [platform-specific parameters](https://info.bundle.social/api-reference/platform-parameters) before using the payload in production.

## Typical integration flow

1. Create or identify the team that owns the integration.
2. Generate an OAuth connection link for the end user.
3. Let the user authorize and select the relevant social account or channel.
4. Store the bundle.social account identifiers in your application.
5. Create, schedule, or publish a post with the appropriate platform parameters.
6. Subscribe to webhooks and update your local state when post status changes.
7. Retrieve analytics or comments when required by the product workflow.

Relevant guides:

- [Connect social accounts](https://info.bundle.social/api-reference/connect-social-accounts)
- [Build a social media scheduler](https://info.bundle.social/guides/building-scheduler)
- [Upload content](https://info.bundle.social/api-reference/upload-content)
- [Webhooks](https://info.bundle.social/api-reference/webhooks)
- [Analytics](https://info.bundle.social/api-reference/analytics)
- [Comments](https://info.bundle.social/api-reference/comments)

## Supported social platforms

bundle.social provides one integration layer for major social networks and community platforms, including:

- Instagram
- TikTok
- Facebook
- LinkedIn
- YouTube
- X (Twitter)
- Pinterest
- Reddit
- Threads
- Snapchat
- Bluesky
- Mastodon
- Discord
- Slack
- Google Business Profile

Platform capabilities and required parameters differ. Always verify the current [platform parameter reference](https://info.bundle.social/api-reference/platform-parameters) for the operation you are implementing.

## Production checklist

Before adapting an example for production:

- Keep API calls and credentials on the server.
- Validate content, media, and platform-specific fields before sending a request.
- Handle OAuth reconnection and account-selection states explicitly.
- Treat publishing as asynchronous and process status updates through webhooks.
- Retry transient failures with backoff; do not retry validation or permission errors blindly.
- Respect the documented [rate limits](https://info.bundle.social/api-reference/rate-limits) and platform limits.
- Log request references and normalized error details without logging secrets.
- Define how your application handles partial success across multiple platforms.
- Test with non-production social accounts before publishing for customers.

See the [error reference](https://info.bundle.social/api-reference/errors), [API limits](https://info.bundle.social/api-reference/limits), and [data retention documentation](https://info.bundle.social/api-reference/data-retention) for operational details.

## Security

- Store `BUNDLE_API_KEY` in a secrets manager or server-side environment variable.
- Do not place API keys in browser bundles, screenshots, issue reports, or example output.
- Rotate a credential immediately if it has been exposed.
- Remove personal data and access tokens before sharing logs or reproduction cases.

## Contributing

Issues and focused pull requests are welcome. A new example should include:

- The use case and intended audience
- Prerequisites and tested runtime version
- Required environment variables without secret values
- Exact install and run commands
- Expected output or verification steps
- Links to the API endpoints used
- Error handling appropriate to the example

Keep credentials, customer data, and generated build artifacts out of commits.

## Get help

- Start with the [documentation](https://info.bundle.social/welcome).
- Reproduce API requests in the [Postman workspace](https://www.postman.com/bundlesocial/workspace/bundle-social-api/overview).
- Open a GitHub issue for a reproducible problem in one of these examples.
- Use the support channel available from your bundle.social account for product or account-specific questions.
