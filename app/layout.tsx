import type { ReactNode } from "react";
import "../styles.css";

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
          content={process.env.SHOPIFY_API_KEY || ""}
        />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
