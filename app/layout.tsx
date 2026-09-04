import type { ReactNode } from "react";
import { headers } from "next/headers";
import "../styles.css";
import {
  getShopifyClientId,
  resolveShopifyAppBridgeApiKey,
  SHOPIFY_LISTING_CLIENT_ID,
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=document.querySelector('meta[name="shopify-api-key"]');if(!m)return;var live=${JSON.stringify(getShopifyClientId())};var listing=${JSON.stringify(SHOPIFY_LISTING_CLIENT_ID)};var token=new URLSearchParams(location.search).get("id_token")||"";if(!token)return;try{var aud=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).aud;if(aud===live||aud===listing)m.setAttribute("content",aud);}catch(e){}})();`,
          }}
        />
        <script src={APP_BRIDGE_CDN}></script>
      </head>
      <body>
        <ShopifyAppBridge />
        {children}
      </body>
    </html>
  );
}
