/**
 * MCP-agent example: drive bundlesocial-mcp from Claude.
 *
 * This script spawns the local `bundlesocial-mcp` server as a child process
 * over stdio, forwards its tool list to the Anthropic Messages API, and runs
 * a manual agentic loop so Claude can call MCP tools to draft + publish posts.
 *
 * Usage:
 *   cp .env.example .env   # fill in ANTHROPIC_API_KEY and BUNDLESOCIAL_API_KEY
 *   pnpm install
 *   npx tsx index.ts "Draft and publish a short post to X about our new MCP server."
 */

import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16000;
const MAX_TURNS = 25; // hard cap on agentic loop iterations

const SYSTEM_PROMPT = `You are an autonomous social-media operator driving the bundle.social API through the bundlesocial-mcp Model Context Protocol server.

Context:
- bundle.social is a multi-platform social-media API supporting X (Twitter), Bluesky, Mastodon, Threads, LinkedIn, Facebook, Instagram, TikTok, YouTube, Pinterest, Reddit, Discord, Slack, and Google Business Profile.
- Each social account ("integration") must already be connected on the team. Use the \`list_integrations\` tool to discover which platforms are available before you try to post. Don't assume — verify.
- For platform-specific fields (Reddit subreddit, Pinterest board, TikTok privacy, YouTube category, Instagram type, etc.), consult the documentation at https://docs.bundle.social/api-reference/platform-parameters. Put per-platform fields under \`platformSettings\` keyed by lowercased platform name (\`x\`, \`bluesky\`, \`reddit\`, ...).
- Media (images, videos, PDFs) must be uploaded first via \`upload_media\` — pass the returned \`id\` to \`create_post\` / \`schedule_post\` as \`uploadIds\` inside the per-platform \`data\` block.
- Errors come back with \`isError: true\` and a JSON \`error\` object. Read the error, adjust, and retry. Do not silently give up.

Operating principles:
1. Discover before acting. Start with \`list_integrations\` (and \`check_setup\` if anything looks off) to confirm what's actually connected.
2. Be concise in the post text. Match the platform — X is short and punchy, LinkedIn is professional, Bluesky is conversational.
3. After publishing, summarize what you did: which platforms, the post ID(s), and any errors.
4. Never invent integration IDs, post IDs, or platform fields. Only use values returned by tool calls.`;

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [k: string]: unknown;
  };
}

/**
 * Convert MCP tool definitions to Anthropic tool definitions.
 *
 * The JSON-schema shapes are compatible: name + description pass through,
 * MCP's `inputSchema` maps directly to Anthropic's `input_schema`.
 */
function mcpToolsToAnthropic(mcpTools: McpToolDefinition[]): Anthropic.Tool[] {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: {
      type: "object" as const,
      properties: (tool.inputSchema.properties ?? {}) as Record<string, unknown>,
      required: tool.inputSchema.required ?? [],
    },
  }));
}

/**
 * Convert an MCP CallToolResult into the content array for an Anthropic
 * `tool_result` block. MCP `text` content passes through verbatim;
 * non-text content (images, audio, embedded resources) is stringified as
 * JSON so Claude can still reason about it.
 */
function mcpResultToAnthropicContent(
  mcpContent: Array<Record<string, unknown>>,
): Anthropic.ToolResultBlockParam["content"] {
  return mcpContent.map((block) => {
    if (block.type === "text" && typeof block.text === "string") {
      return { type: "text" as const, text: block.text };
    }
    // Images, audio, embedded resources — pass through as JSON text.
    // Claude can read the metadata even if it can't view raw binary here.
    return {
      type: "text" as const,
      text: `[non-text MCP content of type "${String(block.type)}"]\n${JSON.stringify(block, null, 2)}`,
    };
  });
}

function extractFinalText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

async function main(): Promise<void> {
  const userPrompt = process.argv.slice(2).join(" ").trim();
  if (!userPrompt) {
    console.error(
      'Usage: npx tsx index.ts "your prompt here"\n\n' +
        'Example: npx tsx index.ts "Draft a short cheerful post announcing our new MCP server and publish to X and Bluesky."',
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in environment. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  if (!process.env.BUNDLESOCIAL_API_KEY) {
    console.error("Missing BUNDLESOCIAL_API_KEY in environment. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  // 1. Spawn bundlesocial-mcp as a child process over stdio.
  //    `npx -y bundlesocial-mcp` resolves the bin from node_modules (or fetches
  //    from the npm registry). The server reads BUNDLESOCIAL_API_KEY from its
  //    own process env, so we pass it through explicitly.
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "bundlesocial-mcp"],
    env: {
      ...process.env,
      BUNDLESOCIAL_API_KEY: process.env.BUNDLESOCIAL_API_KEY,
      ...(process.env.BUNDLESOCIAL_TEAM_ID ? { BUNDLESOCIAL_TEAM_ID: process.env.BUNDLESOCIAL_TEAM_ID } : {}),
      ...(process.env.BUNDLESOCIAL_API_URL ? { BUNDLESOCIAL_API_URL: process.env.BUNDLESOCIAL_API_URL } : {}),
    } as Record<string, string>,
    stderr: "inherit", // surface server-side logs in the same terminal
  });

  const mcp = new McpClient({
    name: "bundlesocial-mcp-agent-example",
    version: "0.1.0",
  });

  await mcp.connect(transport);

  try {
    // 2. Discover tools from the MCP server at runtime.
    const { tools: mcpTools } = await mcp.listTools();
    const anthropicTools = mcpToolsToAnthropic(mcpTools as McpToolDefinition[]);
    console.error(`[agent] loaded ${anthropicTools.length} tools from bundlesocial-mcp`);

    // 3. Run a manual agentic loop against the Messages API.
    //    - `thinking: { type: "adaptive" }` lets Claude decide when to think.
    //      Adaptive is the only thinking mode supported on Opus 4.7; the old
    //      `budget_tokens` form would return 400.
    //    - `output_config.effort: "high"` is explicit because this is an
    //      agentic use case where intelligence matters more than tokens.
    //    - `cache_control: { type: "ephemeral" }` at the top level
    //      auto-caches the largest stable prefix (tools + system), which
    //      pays for itself across every loop iteration.
    //    - No `temperature` / `top_p` / `top_k` — those are removed on
    //      Opus 4.7 and return a 400 if sent.
    const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        cache_control: { type: "ephemeral" },
        system: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      });

      const stop = response.stop_reason;

      if (stop === "tool_use") {
        // Echo the assistant turn (including any thinking blocks) back so the
        // next request sees the full trajectory.
        messages.push({ role: "assistant", content: response.content });

        // Dispatch every tool_use block in this turn to the MCP server,
        // collecting tool_result blocks for the follow-up user message.
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          console.error(`[agent] -> calling MCP tool ${block.name}`);
          let mcpResult: Awaited<ReturnType<typeof mcp.callTool>>;
          try {
            mcpResult = await mcp.callTool({
              name: block.name,
              arguments: (block.input ?? {}) as Record<string, unknown>,
            });
          } catch (err) {
            // Transport-level / protocol-level failure (server crashed,
            // unknown tool, schema validation failed before the tool ran).
            // Surface this as an errored tool_result so Claude can recover.
            const message = err instanceof Error ? err.message : String(err);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: [{ type: "text", text: `MCP transport error: ${message}` }],
              is_error: true,
            });
            continue;
          }

          const isError = mcpResult.isError === true;
          const content = mcpResultToAnthropicContent(
            (mcpResult.content ?? []) as Array<Record<string, unknown>>,
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content,
            is_error: isError,
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Any non-tool stop reason ends the loop. `end_turn` is the happy path;
      // `max_tokens`, `stop_sequence`, `refusal`, `pause_turn` etc. all bubble
      // up here. Print whatever final text Claude produced.
      const finalText = extractFinalText(response.content);
      console.log("\n=== Claude ===");
      console.log(finalText || `(no text content; stop_reason=${stop})`);

      if (stop === "refusal" && response.stop_details) {
        console.error(`\n[agent] refusal: ${JSON.stringify(response.stop_details)}`);
      }
      return;
    }

    console.error(`[agent] hit MAX_TURNS (${MAX_TURNS}) without an end_turn — aborting.`);
  } finally {
    await mcp.close();
  }
}

main().catch((err) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});
