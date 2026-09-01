import type { ReactNode } from "react";
import "../styles.css";
import { getShopifyClientId } from "./api/_lib/shopify-config";

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
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
