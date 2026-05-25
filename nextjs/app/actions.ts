"use server";

import { ApiError } from "bundlesocial";
import { bundlesocial, getTeamId } from "@/lib/bundle";

/**
 * Server actions used by the example pages.
 *
 * Everything here runs on the server. Return shapes are intentionally simple
 * JSON-serializable envelopes — Next.js will serialize them across the
 * RSC boundary back to client components.
 */

export type ActionError = { code: string; message: string };

type ComposeOk = {
  ok: true;
  postId: string;
  status: string;
  uploadId: string | null;
};
type ComposeErr = { ok: false; error: ActionError };
export type ComposeResult = ComposeOk | ComposeErr;

type PlatformKey = "TWITTER" | "BLUESKY" | "LINKEDIN";

const ALL_PLATFORMS: readonly PlatformKey[] = [
  "TWITTER",
  "BLUESKY",
  "LINKEDIN",
] as const;

function toError(err: unknown): ActionError {
  if (err instanceof ApiError) {
    return {
      code: `api_error_${err.status}`,
      // The SDK puts the parsed JSON body on err.body; fall back to message.
      message:
        (err.body && typeof err.body === "object" && "message" in err.body
          ? String((err.body as { message?: unknown }).message)
          : err.message) || "Request to bundle.social failed",
    };
  }
  if (err instanceof Error) {
    return { code: "error", message: err.message };
  }
  return { code: "unknown_error", message: "Something went wrong" };
}

/**
 * Compose & post — uploads an optional image, then schedules a post for
 * immediate publication on the selected platforms.
 */
export async function composeAndPost(
  _prev: ComposeResult | null,
  formData: FormData
): Promise<ComposeResult> {
  try {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) {
      return {
        ok: false,
        error: { code: "validation", message: "Text is required." },
      };
    }

    // Checkbox values arrive as the field name when checked.
    const selected = ALL_PLATFORMS.filter(
      (p) => formData.get(`platform_${p}`) === "on"
    );
    if (selected.length === 0) {
      return {
        ok: false,
        error: {
          code: "validation",
          message: "Pick at least one platform.",
        },
      };
    }

    const teamId = await getTeamId();

    // Optional file upload. The file input is named "image"; an empty input
    // still produces a File whose size is 0, so guard against that.
    const file = formData.get("image");
    let uploadId: string | null = null;
    if (file instanceof File && file.size > 0) {
      const upload = await bundlesocial.upload.uploadCreate({
        formData: { teamId, file },
      });
      uploadId = upload.id;
    }

    // Build the per-platform data object. We keep it minimal (text + uploadIds)
    // — see https://docs.bundle.social/api-reference/platform-parameters for
    // everything each platform supports.
    const uploadIds = uploadId ? [uploadId] : undefined;
    const data: Record<PlatformKey, { text: string; uploadIds?: string[] }> = {
      TWITTER: { text, uploadIds },
      BLUESKY: { text, uploadIds },
      LINKEDIN: { text, uploadIds },
    };
    const platformData: Partial<typeof data> = {};
    for (const p of selected) platformData[p] = data[p];

    const post = await bundlesocial.post.postCreate({
      requestBody: {
        teamId,
        title: text.slice(0, 60) || "Untitled",
        status: "SCHEDULED",
        postDate: new Date().toISOString(),
        socialAccountTypes: selected,
        data: platformData,
      },
    });

    return {
      ok: true,
      postId: post.id,
      status: post.status,
      uploadId,
    };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/**
 * Connect a social account — returns a hosted portal URL that the browser
 * should be redirected to. After the user finishes the flow, bundle.social
 * sends them back to `redirectUrl`.
 */
export async function createConnectLink(
  type: "TIKTOK" | "INSTAGRAM"
): Promise<{ url: string } | { error: ActionError }> {
  try {
    const teamId = await getTeamId();

    // Best-effort detection of the public URL we should redirect back to.
    // In production set NEXT_PUBLIC_APP_URL; in dev we default to localhost.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const res = await bundlesocial.socialAccount.socialAccountCreatePortalLink(
      {
        requestBody: {
          teamId,
          socialAccountTypes: [type],
          redirectUrl: `${appUrl}/connect`,
        },
      }
    );

    return { url: res.url };
  } catch (err) {
    return { error: toError(err) };
  }
}
