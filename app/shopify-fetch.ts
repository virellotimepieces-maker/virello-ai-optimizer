"use client";

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

/** Adds a fresh Shopify ID token when the app is running in Shopify Admin. */
export async function shopifyFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  try {
    const token = await window.shopify?.idToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } catch (error) {
    console.error("SHOPIFY_ID_TOKEN_ERROR", error);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
