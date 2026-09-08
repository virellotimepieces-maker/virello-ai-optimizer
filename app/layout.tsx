import type { ReactNode } from "react";
import { headers } from "next/headers";
import "../styles.css";
import {
  getShopifyClientId,
  resolveShopifyAppBridgeApiKey,
} from "./api/_lib/shopify-config";
import ShopifyAppBridge from "./shopify-app-bridge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Virello AI Optimizer",
  description: "AI-powered product optimization for Shopify stores.",
};

const APP_BRIDGE_CDN = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerStore = await headers();
  const search = headerStore.get("x-virello-search") || "";
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const loadAppBridge = Boolean(params.get("host") || params.get("id_token"));
  const apiKey =
    resolveShopifyAppBridgeApiKey(search) || getShopifyClientId();

  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        {loadAppBridge ? <script src={APP_BRIDGE_CDN}></script> : null}
      </head>
      <body>
        <ShopifyAppBridge />
        {children}
      </body>
    </html>
  );
}
