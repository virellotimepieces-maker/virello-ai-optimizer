"use client";

import { useEffect } from "react";

export default function ShopifyAppBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedded =
      params.get("embedded") === "1" ||
      Boolean(params.get("host"));

    if (
      !embedded ||
      document.querySelector(
        'script[data-virello-app-bridge="true"]'
      )
    ) {
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    script.async = true;
    script.dataset.virelloAppBridge = "true";
    document.head.appendChild(script);
  }, []);

  return null;
}
