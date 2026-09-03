"use client";

import { useEffect, useRef } from "react";
import { copyEmbedQuery, isShopifyAdminIframe } from "./shopify-embed";

function isEmbeddedBrowser(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("embedded") === "1" || Boolean(params.get("host"))) {
    return true;
  }
  return isShopifyAdminIframe();
}

export default function ShopifyAppBridge() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !isEmbeddedBrowser()) return;
    started.current = true;

    let cancelled = false;

    async function handshake() {
      const deadline = Date.now() + 8000;
      while (!window.shopify?.idToken && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (cancelled || !window.shopify?.idToken) return;

      const token = await window.shopify.idToken();
      if (!token) return;

      const response = await fetch("/api/auth/shopify/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        connected?: boolean;
        shop?: string;
      } | null;
      if (cancelled || !data?.success || !data.connected) return;

      const path = window.location.pathname;
      if (path === "/connect" || path.startsWith("/connect/")) {
        const next = copyEmbedQuery(
          new URLSearchParams(window.location.search),
          new URL("/", window.location.origin)
        );
        next.searchParams.set("connected", "1");
        if (data.shop) next.searchParams.set("shop", data.shop);
        window.location.replace(next.toString());
      }
    }

    handshake().catch((error) => {
      console.error("SHOPIFY_SESSION_HANDSHAKE_ERROR", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
