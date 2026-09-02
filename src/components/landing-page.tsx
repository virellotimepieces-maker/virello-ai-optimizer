"use client";

import Link from "next/link";
import { ArrowRight, FileWarning, Languages, ShieldOff, Split } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/components/language-provider";
import { cn } from "@/lib/utils";

const failures = [
  {
    icon: FileWarning,
    fil: {
      title: "Template leftover",
      body: "Lorem, Framer watermark, health-crisis copy — naiwan sa prompt. Binabasa iyon ng AI bilang totoo.",
    },
    en: {
      title: "Template leftover",
      body: "Lorem, Framer watermarks, health-crisis copy — left inside the prompt. The AI reads them as true.",
    },
  },
  {
    icon: Split,
    fil: {
      title: "Halo-halong identity",
      body: "Social dashboard kahapon, AI optimizer ngayon. Dalawang product sa isang spec. Hindi alam ng model kung sino siya.",
    },
    en: {
      title: "Mixed identity",
      body: "A social dashboard yesterday, an AI optimizer today. Two products in one spec. The model cannot tell who it is.",
    },
  },
  {
    icon: ShieldOff,
    fil: {
      title: "FAQ na walang sagot",
      body: "May tanong, walang sagot. Kaya nag-iimbento ng features, metrics, at customers.",
    },
    en: {
      title: "FAQ with no answers",
      body: "Questions sit without answers, so the model invents features, metrics, and customers.",
    },
  },
  {
    icon: Languages,
    fil: {
      title: "Walang language policy",
      body: "Filipino, English, Taglish — walang rule. Halo-halo ang sagot kahit ayaw mo.",
    },
    en: {
      title: "No language policy",
      body: "Filipino, English, Taglish — no rule. Replies mix even when you do not want them to.",
    },
  },
];

const steps = [
  {
    n: "01",
    fil: { title: "I-paste ang sira", body: "System prompt, knowledge, FAQ, chatbot script, o Cursor rules." },
    en: { title: "Paste what is broken", body: "System prompt, knowledge, FAQ, chatbot script, or Cursor rules." },
  },
  {
    n: "02",
    fil: { title: "Pangalanan ang sira", body: "Tinitingnan namin ang placeholder, contradiction, fake metrics, at empty FAQ." },
    en: { title: "Name the breaks", body: "We flag placeholders, contradictions, fake metrics, and empty FAQs." },
  },
  {
    n: "03",
    fil: { title: "Kopyahin ang tama", body: "Apat na file: system prompt, knowledge, guardrails, FAQ — paste-ready." },
    en: { title: "Copy the fix", body: "Four files: system prompt, knowledge, guardrails, FAQ — paste-ready." },
  },
];

export function LandingPage() {
  const { t, lang } = useLang();

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-[color:var(--card)] px-3 py-1 text-xs tracking-[0.16em] uppercase">
          <span className="size-1.5 rounded-full bg-[color:var(--lime)]" />
          {t("Content clinic para sa AI", "Content clinic for AI")}
        </p>
        <h1 className="max-w-4xl font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          {t(
            "Mali ang sagot ng AI mo dahil mali ang laman.",
            "Your AI answers wrong because the contents are wrong."
          )}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
          {t(
            "Hindi modelo ang unang ayusin. Ang system prompt, knowledge, at instructions — dyan nanggagaling ang gawa-gawang features, leftover template, at halo-halong identity. Virello tinitingnan iyon at sinusulat ulit nang tama.",
            "Do not start with the model. Start with the system prompt, knowledge, and instructions — that is where invented features, leftover templates, and mixed identity come from. Virello reads that and rewrites it correctly."
          )}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/studio"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 px-5 text-base"
            )}
          >
            {t("Ayusin ang laman", "Fix the contents")}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/studio?sample=virello"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 px-5 text-base"
            )}
          >
            {t("Tingnan ang sira na sample", "Open the broken sample")}
          </Link>
        </div>
        <p className="mt-4 text-sm text-foreground/55">
          {t(
            "Walang API key. Tumutakbo sa browser. Hindi namin iniimbak ang paste mo.",
            "No API key. Runs in the browser. We do not store your paste."
          )}
        </p>
      </section>

      <section className="border-y border-foreground/10 bg-[color:var(--card)]">
        <div className="mx-auto grid max-w-6xl gap-px bg-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
          {failures.map((item) => {
            const copy = lang === "fil" ? item.fil : item.en;
            const Icon = item.icon;
            return (
              <article
                key={item.fil.title}
                className="bg-[color:var(--card)] px-5 py-6 sm:px-6"
              >
                <Icon className="mb-4 size-5 text-[color:var(--heal)]" />
                <h2 className="font-heading text-lg font-semibold">{copy.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                  {copy.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Tatlong hakbang. Walang magic model.", "Three steps. No magic model.")}
        </h2>
        <p className="mt-3 max-w-2xl text-foreground/65">
          {t(
            "Deterministic clinic ito: parehong paste, parehong diagnosis. Hindi kami nag-iimbento ng features para magmukhang smart.",
            "This is a deterministic clinic: the same paste yields the same diagnosis. We do not invent features to look smart."
          )}
        </p>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const copy = lang === "fil" ? step.fil : step.en;
            return (
              <li
                key={step.n}
                className="rounded-2xl border border-foreground/10 bg-[color:var(--card)] p-6"
              >
                <span className="font-mono text-xs tracking-[0.2em] text-foreground/45">
                  {step.n}
                </span>
                <h3 className="mt-3 font-heading text-xl font-semibold">
                  {copy.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                  {copy.body}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl border border-foreground/10 bg-foreground text-[color:var(--background)] lg:grid-cols-2">
          <div className="p-7 sm:p-10">
            <p className="text-xs tracking-[0.18em] text-[color:var(--lime)] uppercase">
              {t("Bago", "Before")}
            </p>
            <h3 className="mt-3 font-heading text-2xl font-semibold">
              {t("Template ang tinuturo sa AI", "The AI is taught a template")}
            </h3>
            <pre className="mt-5 overflow-x-auto font-mono text-[12px] leading-relaxed text-[color:var(--background)]/75">
{`You are Virello, Social Intelligence.
Trusted by 150k+ Users.
Every year, millions of people
face preventable health crises.
FAQ
What platforms can I connect?
Is Virello AI-powered?`}
            </pre>
          </div>
          <div className="border-t border-[color:var(--background)]/10 bg-[color:var(--heal)] p-7 text-[color:var(--background)] sm:p-10 lg:border-t-0 lg:border-l">
            <p className="text-xs tracking-[0.18em] uppercase opacity-80">
              {t("Pagkatapos", "After")}
            </p>
            <h3 className="mt-3 font-heading text-2xl font-semibold">
              {t("Isang identity. Mga totoo lang.", "One identity. Only what is true.")}
            </h3>
            <pre className="mt-5 overflow-x-auto font-mono text-[12px] leading-relaxed opacity-90">
{`You are Virello AI Optimizer.
Job: diagnose and rewrite AI contents.
Never invent metrics or features.
FAQ answers are written, not blank.
Discard: Framer, health copy, 150k.`}
            </pre>
            <Link
              href="/studio?sample=virello"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("Patakbuhin ang sample na ito", "Run this sample")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
