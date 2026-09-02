"use client";

import { SiteHeader } from "@/components/site-header";
import { useLang } from "@/components/language-provider";

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-auto border-t border-foreground/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-foreground/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Virello AI Optimizer</p>
        <p>
          {t(
            "Isang identity. Mga totoo lang. Walang leftover template.",
            "One identity. Only what is true. No leftover template."
          )}
        </p>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
