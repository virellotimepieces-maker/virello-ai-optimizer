"use client";

import { useEffect, useRef } from "react";
import { copyEmbedQuery, isShopifyAdminIframe } from "./shopify-embed";
import { normalizeShop, shopFromShopifyHostParam } from "./api/_lib/shop-domain";

function decodeJwtPayload(token: string): { aud?: string; dest?: string } {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { aud?: string; dest?: string };
    return payload;
  } catch {
    return {};
  }
}

function embeddedShop(token = ""): string {
  const params = new URLSearchParams(window.location.search);
  const fromToken = decodeJwtPayload(token);
  return (
    normalizeShop(params.get("shop") || "") ||
    shopFromShopifyHostParam(params.get("host") || "") ||
    normalizeShop(fromToken.dest || "")
  );
}

export default function ShopifyAppBridge() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    async function handshake() {
      const params = new URLSearchParams(window.location.search);
      const embedded =
        params.get("embedded") === "1" ||
        Boolean(params.get("host")) ||
        Boolean(params.get("id_token")) ||
        isShopifyAdminIframe();

      const deadline = Date.now() + 8000;
      while (!window.shopify?.idToken && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (cancelled) return;

      if (!window.shopify?.idToken) {
        if (embedded) {
          window.dispatchEvent(
            new CustomEvent("virello-shopify-session", {
              detail: { connected: false, authenticating: true },
            })
          );
        }
        return;
      }

      let lastShop = embeddedShop();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled) return;
        const token = await window.shopify.idToken();
        if (!token) continue;
        lastShop = embeddedShop(token) || lastShop;

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

        if (response.ok && data?.success && data.connected) {
          window.dispatchEvent(
            new CustomEvent("virello-shopify-session", {
              detail: { connected: true, shop: data.shop || lastShop },
            })
          );

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
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      if (embedded) {
        window.dispatchEvent(
          new CustomEvent("virello-shopify-session", {
            detail: { connected: false, authenticating: true, shop: lastShop },
          })
        );
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
