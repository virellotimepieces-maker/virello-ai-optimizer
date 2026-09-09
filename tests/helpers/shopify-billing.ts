import { setShopifyAdminFetchForTests } from "../../app/api/_lib/shopify-admin";
import { saveShopifyAppSubscription } from "../../app/api/_lib/shopify-billing";

export const TEST_SUBSCRIPTION_GID = "gid://shopify/AppSubscription/1";
export const TEST_CONFIRMATION_URL =
  "https://admin.shopify.com/charges/store-alpha/confirm-test";

export function graphqlJson(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async text() {
      return JSON.stringify({ data });
    },
  };
}

export async function seedShopifyBilling(
  shop: string,
  input: {
    subscriptionGid?: string;
    status?: string;
    test?: boolean;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    confirmationUrl?: string;
  } = {}
) {
  const currentPeriodEnd =
    input.currentPeriodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  return saveShopifyAppSubscription({
    shop,
    subscriptionGid: input.subscriptionGid || TEST_SUBSCRIPTION_GID,
    status: input.status || "ACTIVE",
    test: input.test !== false,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd,
    confirmationUrl: input.confirmationUrl || "",
  });
}

export function mockShopifyBillingGraphql(
  options: {
    partnerDevelopment?: boolean;
    active?: Array<{
      id?: string;
      name?: string;
      status?: string;
      test?: boolean;
      currentPeriodEnd?: string | null;
    }>;
    created?: {
      confirmationUrl?: string | null;
      appSubscription?: {
        id?: string;
        name?: string;
        status?: string;
        test?: boolean;
        currentPeriodEnd?: string | null;
      } | null;
      userErrors?: Array<{ field?: string[] | null; message?: string | null }>;
    };
    node?: {
      id?: string;
      name?: string;
      status?: string;
      test?: boolean;
      currentPeriodEnd?: string | null;
    } | null;
  } = {}
) {
  setShopifyAdminFetchForTests(async (_url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    const query = String(body.query || "");
    if (query.includes("appSubscriptionCreate")) {
      return graphqlJson({
        appSubscriptionCreate: options.created ?? {
          confirmationUrl: TEST_CONFIRMATION_URL,
          appSubscription: {
            id: "gid://shopify/AppSubscription/99",
            name: "Virello AI Optimizer",
            status: "PENDING",
            test: true,
            currentPeriodEnd: null,
          },
          userErrors: [],
        },
      });
    }
    if (query.includes("VirelloAppSubscriptionNode")) {
      return graphqlJson({ node: options.node ?? null });
    }
    return graphqlJson({
      shop: { plan: { partnerDevelopment: options.partnerDevelopment !== false } },
      currentAppInstallation: { activeSubscriptions: options.active ?? [] },
    });
  });
}
