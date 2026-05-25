# bundlesocial-mcp + Anthropic SDK — agent example

A minimal TypeScript example that drives the [`bundlesocial-mcp`](https://github.com/bundleglobal/bundlesocial-mcp) server from Claude. Claude drafts the post text and calls MCP tools (`list_integrations`, `upload_media`, `create_post`, `schedule_post`, `get_post_analytics`, ...) to actually publish — over the [bundle.social](https://bundle.social) API, to 14+ social platforms.

## What this shows

- **Claude as the agent.** The Anthropic Messages API decides which tools to call; we just run the loop.
- **`bundlesocial-mcp` as a local stdio MCP server.** We spawn `npx bundlesocial-mcp` as a child process via [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)'s `StdioClientTransport` and proxy its tools to Claude.
- **No hardcoded tool list.** `mcpClient.listTools()` is called at startup; whatever bundlesocial-mcp exposes is what Claude sees. New tools added upstream show up automatically.

## Architecture

```
                      ┌────────────────────┐
                      │  Anthropic API     │
                      │  (claude-opus-4-7) │
                      └─────────┬──────────┘
                                │ messages.create() + tool_use
                                │
                   ┌────────────▼─────────────┐
                   │  index.ts                │
                   │  - manual agentic loop   │
                   │  - tool dispatch         │
                   └──────┬───────────────────┘
                          │ MCP JSON-RPC over stdio
                          │
              ┌───────────▼────────────────┐
              │  bundlesocial-mcp          │
              │  (child process)           │
              └───────────┬────────────────┘
                          │ bundle.social Node SDK
                          ▼
                   bundle.social API
                   → X, Bluesky, LinkedIn,
                     Instagram, TikTok, ...
```

On every `stop_reason: "tool_use"`, each `tool_use` block is forwarded to `mcpClient.callTool({ name, arguments })`. The MCP result (`content[]`, `isError`) is folded back into Claude as a `tool_result` block. Loop until `end_turn`.

## Anthropic API conventions used here

This example bakes in the current recommended defaults for an agentic workload on Opus 4.7:

- **Model:** `claude-opus-4-7` (the latest, most capable Opus).
- **Thinking:** `thinking: { type: "adaptive" }` — adaptive is the only thinking mode supported on Opus 4.7. The legacy `budget_tokens` form returns a 400.
- **Effort:** `output_config: { effort: "high" }` — explicit, because intelligence matters for tool-calling agents.
- **Max tokens:** `max_tokens: 16000` per turn — plenty of headroom for several tool calls without HTTP-timeout risk.
- **Prompt caching:** `cache_control: { type: "ephemeral" }` at the top level auto-caches the largest stable prefix (tools + system prompt). Every iteration of the loop reads from that cache instead of re-paying for the prefix.
- **No `temperature`, `top_p`, `top_k`** — those are removed on Opus 4.7 and would 400.

## Setup

```bash
# from the bundlesocial-examples root
cd mcp-agent
pnpm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY and BUNDLESOCIAL_API_KEY
```

`BUNDLESOCIAL_TEAM_ID` is optional — set it only if your bundle.social organization has more than one team.

Type-check:

```bash
pnpm exec tsc --noEmit
```

## Run

```bash
npx tsx index.ts "Draft a short cheerful post announcing our new MCP server and publish to X and Bluesky."
```

The script will:

1. Spawn `bundlesocial-mcp` as a child process (`npx -y bundlesocial-mcp`).
2. Discover tools via `listTools()`.
3. Send your prompt to Claude with the tool list attached.
4. On each `tool_use`, call the MCP tool and feed the result back.
5. Print Claude's final text response when the loop ends.

Tool-call traces are written to stderr; only Claude's final answer goes to stdout.

## Example prompts to try

- `"Run check_setup and tell me whether bundle.social is ready to publish."`
- `"List the connected integrations and summarize which platforms we can post to."`
- `"Draft a short, cheerful post announcing our new MCP server and publish it to X and Bluesky right now."`
- `"Schedule a post for tomorrow at 9am UTC announcing our v2 release — target LinkedIn and Threads."`
- `"Upload https://picsum.photos/1200/630 as a featured image, then publish a launch post with it to LinkedIn."`
- `"Find my three most recent published posts and pull their analytics."`
- `"Look up the trending music on TikTok via the integration tools, then draft (don't publish — save as draft) a TikTok caption that references one of those tracks."`

## Why this pattern?

bundlesocial-mcp ships today as a **local stdio MCP server** (`npx bundlesocial-mcp`). Any MCP client that can spawn a subprocess can use it — Claude Desktop, Claude Code, Cursor, or, as shown here, your own application via `@modelcontextprotocol/sdk`.

The Anthropic Messages API also has a native `mcp_servers` parameter, but it's designed for *remote HTTP* MCP servers (the server is reachable from Anthropic's infrastructure). Local stdio servers don't fit that model — they live on your machine and need a process to spawn them. So the right shape today is what this example does: a local stdio client + a manual agentic loop.

A hosted remote HTTP MCP server at `mcp.bundle.social` is on the roadmap. Once it ships, you can swap the stdio client for the Anthropic API's `mcp_servers` parameter and drop the manual loop. The system prompt and tool surface stay the same.

This is the canonical pattern for hooking any local MCP server up to Claude — point the `StdioClientTransport` at a different command and you've got an agent over a different MCP server.

## File layout

```
mcp-agent/
├── index.ts        # the agent (~150 lines)
├── package.json    # @anthropic-ai/sdk, @modelcontextprotocol/sdk, bundlesocial-mcp
├── tsconfig.json   # strict ESM + ES2022
├── .env.example
└── README.md
```
