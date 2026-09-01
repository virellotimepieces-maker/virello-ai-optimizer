import type { ReactNode } from "react";
import "../styles.css";
import { getShopifyClientId } from "./api/_lib/shopify-config";
import ShopifyAppBridge from "./shopify-app-bridge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Virello AI Optimizer",
  description: "AI-powered product optimization for Shopify stores.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="shopify-api-key"
          content={getShopifyClientId()}
        />
      </head>
      <body>
        <ShopifyAppBridge />
        {children}
      </body>
    </html>
  );
}
