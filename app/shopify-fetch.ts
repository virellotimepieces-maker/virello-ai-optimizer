"use client";

import { isShopifyAdminIframe } from "./shopify-embed";

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

function likelyShopifyAdmin(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("embedded") === "1" ||
    Boolean(params.get("host")) ||
    Boolean(params.get("id_token")) ||
    isShopifyAdminIframe()
  );
}

async function waitForShopifyIdToken(ms = 2500): Promise<string> {
  if (window.shopify?.idToken) {
    return (await window.shopify.idToken()) || "";
  }
  if (!likelyShopifyAdmin()) return "";

  const deadline = Date.now() + ms;
  while (!window.shopify?.idToken && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return (await window.shopify?.idToken?.()) || "";
}

/** Adds a fresh Shopify ID token when App Bridge is present. */
export async function shopifyFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  try {
    const token = await waitForShopifyIdToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch (error) {
    console.error("SHOPIFY_ID_TOKEN_ERROR", error);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
