import { NextResponse } from "next/server";
import { bundlesocial } from "@/lib/bundle";

/**
 * Webhook receiver.
 *
 * bundle.social signs the body with HMAC-SHA256 using your webhook secret and
 * sends the hex digest in the `x-signature` header. `constructEvent` re-hashes
 * the body and throws if it doesn't match — see the express example
 * for the same pattern outside of Next.
 *
 * IMPORTANT: we need the *raw* body text to verify the signature, so this
 * route reads `await req.text()` instead of `await req.json()`. Re-parsing
 * after verification happens inside `constructEvent`.
 */

export const runtime = "nodejs"; // crypto module isn't on the edge runtime.

const secret = process.env.BUNDLESOCIAL_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!secret) {
    // We don't throw at module scope here — `next build` collects route
    // metadata and would fail builds for users who don't have the secret
    // configured. Erroring on the request is a friendlier dev experience.
    return NextResponse.json(
      { error: "BUNDLESOCIAL_WEBHOOK_SECRET is not configured." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("x-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing x-signature header." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  try {
    const event = bundlesocial.webhooks.constructEvent(
      rawBody,
      signature,
      secret
    );

    // `event` is a discriminated union — narrow on `event.type` to get the
    // right `event.data` shape. Here we just log a summary.
    switch (event.type) {
      case "post.published":
        console.log("[webhook] post.published", { id: event.data.id });
        break;
      case "comment.published":
        console.log("[webhook] comment.published", { id: event.data.id });
        break;
      case "team.created":
      case "team.updated":
      case "team.deleted":
        console.log(`[webhook] ${event.type}`, { id: event.data.id });
        break;
      case "social-account.created":
      case "social-account.updated":
      case "social-account.deleted":
        console.log(`[webhook] ${event.type}`, {
          id: event.data.id,
          provider: event.data.type,
        });
        break;
      default: {
        // Exhaustiveness check — if the SDK adds a new event type, TS errors here.
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.warn("[webhook] signature verification failed", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }
}
