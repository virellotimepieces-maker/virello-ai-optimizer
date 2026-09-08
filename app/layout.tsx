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
  const apiKey =
    resolveShopifyAppBridgeApiKey(headerStore.get("x-virello-search") || "") ||
    getShopifyClientId();

  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        <script src={APP_BRIDGE_CDN}></script>
      </head>
      <body>
        <ShopifyAppBridge />
        {children}
      </body>
    </html>
  );
}
