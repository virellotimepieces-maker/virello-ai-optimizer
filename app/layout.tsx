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
      <body>{children}</body>
    </html>
  );
}
