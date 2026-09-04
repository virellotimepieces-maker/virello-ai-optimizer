"use client";

import { useEffect, useRef } from "react";
import { copyEmbedQuery, assignTopLevel, isShopifyAdminIframe } from "./shopify-embed";
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

function embeddedShop(token = ""): { shop: string; aud: string } {
  const params = new URLSearchParams(window.location.search);
  const fromToken = decodeJwtPayload(token);
  const shop =
    normalizeShop(params.get("shop") || "") ||
    shopFromShopifyHostParam(params.get("host") || "") ||
    normalizeShop(fromToken.dest || "");
  const aud = (fromToken.aud || params.get("aud") || "").trim();
  return { shop, aud };
}

function startEmbeddedOauth(token = "") {
  const { shop, aud } = embeddedShop(token);
  if (!shop) return;
  const next = new URL("/api/auth/shopify", window.location.origin);
  next.searchParams.set("shop", shop);
  next.searchParams.set("flow", "embedded");
  if (aud) next.searchParams.set("aud", aud);
  assignTopLevel(next.toString());
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
        if (embedded) startEmbeddedOauth();
        return;
      }

      const token = await window.shopify.idToken();
      if (!token) {
        if (embedded) startEmbeddedOauth();
        return;
      }

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
      if (cancelled) return;

      if (!response.ok || !data?.success || !data.connected) {
        if (embedded) startEmbeddedOauth(token);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("virello-shopify-session", {
          detail: { connected: true, shop: data.shop },
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
