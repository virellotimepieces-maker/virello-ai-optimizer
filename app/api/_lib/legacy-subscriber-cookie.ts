import { createHmac, timingSafeEqual } from "node:crypto";

export type LegacySubscriberPayload = {
  v: 1;
  subscriptionId: string;
  customerId: string;
};

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function cookieSecrets(): string[] {
  return [process.env.SUBSCRIBER_COOKIE_SECRET, process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY]
    .map((value) => value?.trim() || "")
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

export function decodeLegacySubscriberCookie(
  value: string,
  secrets = cookieSecrets()
): LegacySubscriberPayload | null {
  const raw = value.trim();
  if (!raw || !secrets.length) return null;

  for (const secret of secrets) {
    const payload = decodeWithSecret(raw, secret);
    if (payload) return payload;
  }
  return null;
}

function decodeWithSecret(
  value: string,
  secret: string
): LegacySubscriberPayload | null {
  try {
    const [encodedPayload, signature] = value.split(".");
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signPayload(encodedPayload, secret);
    const received = Buffer.from(signature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    if (received.length !== expected.length) return null;
    if (!timingSafeEqual(received, expected)) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<LegacySubscriberPayload> & { v?: number };

    if (
      payload?.v !== 1 ||
      typeof payload.subscriptionId !== "string" ||
      typeof payload.customerId !== "string" ||
      !payload.subscriptionId ||
      !payload.customerId
    ) {
      return null;
    }

    return {
      v: 1,
      subscriptionId: payload.subscriptionId,
      customerId: payload.customerId,
    };
  } catch {
    return null;
  }
}

export function signLegacySubscriberCookieForTests(
  payload: LegacySubscriberPayload,
  secret: string
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}
