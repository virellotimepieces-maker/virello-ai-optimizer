import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";

export type WebhookClaim = "claimed" | "duplicate" | "retry";

export async function claimWebhookEvent(input: {
  provider: "stripe" | "shopify";
  eventId: string;
  eventType?: string;
  shop?: string;
  providerCreated?: number;
}): Promise<WebhookClaim> {
  const shop = input.shop ? normalizeShop(input.shop) : "";

  const inserted = await dbQuery<{ event_id: string }>(
    `INSERT INTO webhook_events (
       provider, event_id, event_type, shop, status, provider_created
     )
     VALUES ($1, $2, $3, $4, 'claimed', $5)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING event_id`,
    [
      input.provider,
      input.eventId,
      input.eventType ?? null,
      shop || null,
      input.providerCreated ?? null,
    ]
  );

  if (inserted.length) {
    if (input.provider === "stripe") {
      await dbQuery(
        `INSERT INTO stripe_webhook_events (event_id, provider, event_type, shop, status)
         VALUES ($1, 'stripe', $2, $3, 'claimed')
         ON CONFLICT (event_id) DO NOTHING`,
        [input.eventId, input.eventType ?? null, shop || null]
      );
    }
    return "claimed";
  }

  const existing = await dbQuery<{ status: string }>(
    `SELECT status
     FROM webhook_events
     WHERE provider = $1 AND event_id = $2
     LIMIT 1`,
    [input.provider, input.eventId]
  );

  if (existing[0]?.status === "processed") return "duplicate";
  return "retry";
}

export async function markWebhookEvent(
  provider: "stripe" | "shopify",
  eventId: string,
  status: "processed" | "failed"
): Promise<void> {
  await dbQuery(
    `UPDATE webhook_events
     SET status = $3,
         processed_at = CASE WHEN $3 = 'processed' THEN NOW() ELSE processed_at END
     WHERE provider = $1 AND event_id = $2`,
    [provider, eventId, status]
  );

  if (provider === "stripe") {
    await dbQuery(
      `UPDATE stripe_webhook_events
       SET status = $2
       WHERE event_id = $1`,
      [eventId, status]
    );
  }
}
