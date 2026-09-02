import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "../styles.css";
import { getShopifyClientId } from "./api/_lib/shopify-config";
import { parseAppLocale, UI_LANG_COOKIE } from "./api/_lib/locales";
import ShopifyAppBridge from "./shopify-app-bridge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Virello AI Optimizer",
  description: "AI-powered product optimization for Shopify stores.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const ui = parseAppLocale(cookieStore.get(UI_LANG_COOKIE)?.value);
  return (
    <html lang={ui === "fil" ? "fil" : "en"}>
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
