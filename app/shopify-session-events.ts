export type ShopifySessionDetail = {
  connected?: boolean;
  shop?: string;
  authenticating?: boolean;
};

let lastDetail: ShopifySessionDetail | null = null;

export function lastShopifySessionDetail(): ShopifySessionDetail | null {
  return lastDetail;
}

export function resetShopifySessionDetailForTests(): void {
  lastDetail = null;
}

export function publishShopifySession(detail: ShopifySessionDetail): void {
  lastDetail = detail;
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  const payload = detail;
  queueMicrotask(() => {
    window.dispatchEvent(
      new CustomEvent("virello-shopify-session", {
        detail: payload,
      })
    );
  });
}
