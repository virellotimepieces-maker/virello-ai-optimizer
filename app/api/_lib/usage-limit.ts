export type SubscriberUsage = {
  limit: number;
  used: number;
  remaining: number;
};

export const DEFAULT_AI_USAGE_LIMIT = 1000;

export function getUsageLimit(): number {
  const raw = process.env.AI_SUBSCRIBER_USAGE_LIMIT?.trim();
  if (!raw) return DEFAULT_AI_USAGE_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_AI_USAGE_LIMIT;
  return parsed;
}
