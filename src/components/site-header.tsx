"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/components/language-provider";
import { cn } from "@/lib/utils";

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M8 17.5 13.2 23 24 9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[color:var(--lime)]"
      />
    </svg>
  );
}

export function SiteHeader() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const inStudio = pathname.startsWith("/studio");

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-[color:var(--background)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark className="size-8" />
          <span className="leading-tight">
            <span className="block font-heading text-[17px] font-semibold tracking-tight">
              Virello
            </span>
            <span className="block text-[11px] tracking-[0.18em] text-foreground/55 uppercase">
              AI Optimizer
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="mr-1 flex rounded-full border border-foreground/15 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang("fil")}
              className={cn(
                "rounded-full px-2.5 py-1",
                lang === "fil"
                  ? "bg-foreground text-background"
                  : "text-foreground/70"
              )}
            >
              FIL
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn(
                "rounded-full px-2.5 py-1",
                lang === "en"
                  ? "bg-foreground text-background"
                  : "text-foreground/70"
              )}
            >
              EN
            </button>
          </div>
          {inStudio ? (
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("Home", "Home")}
            </Link>
          ) : (
            <Link href="/studio" className={buttonVariants({ size: "lg" })}>
              {t("Ayusin ang AI", "Fix the AI")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
