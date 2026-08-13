import "./styles.css";

export const metadata = {
  title: "Virello AI",
  description: "All-in-One AI Store Builder for Shopify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
