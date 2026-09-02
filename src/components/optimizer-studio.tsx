"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLang } from "@/components/language-provider";
import {
  AI_KINDS,
  BROKEN_VIRELLO_SAMPLE,
  PROBLEM_SYMPTOMS,
  SAMPLE_PROBLEMS,
  SAMPLE_SYMPTOMS,
  defaultInput,
  optimize,
  type AIKind,
  type OptimizeInput,
  type OptimizeResult,
  type ReplyLang,
} from "@/lib/optimizer";
import { cn } from "@/lib/utils";

const STAGES = [
  { fil: "Binabasa ang laman…", en: "Reading the contents…" },
  { fil: "Tinutukoy ang sira…", en: "Naming the breaks…" },
  { fil: "Sinusulat ulit ang spec…", en: "Rewriting the spec…" },
];

function downloadText(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color =
    score < 40 ? "var(--destructive)" : score < 70 ? "#B45309" : "var(--heal)";
  return (
    <div className="relative size-24">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-foreground/10"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-heading text-2xl font-semibold">{score}</span>
      </div>
    </div>
  );
}

export function OptimizerStudio() {
  const { t, lang } = useLang();
  const searchParams = useSearchParams();
  const [input, setInput] = useState<OptimizeInput>(defaultInput);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("sample") === "virello") {
      setInput((prev) => ({
        ...prev,
        contents: BROKEN_VIRELLO_SAMPLE,
        problems: SAMPLE_PROBLEMS,
        symptoms: [...SAMPLE_SYMPTOMS],
        productName: "Virello AI Optimizer",
        productJob:
          "Diagnose and rewrite system prompts, knowledge, and instructions so the AI answers from correct contents.",
      }));
    }
  }, [searchParams]);

  const running = stage !== null;

  function patch<K extends keyof OptimizeInput>(key: K, value: OptimizeInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(id: string) {
    setInput((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(id)
        ? prev.symptoms.filter((s) => s !== id)
        : [...prev.symptoms, id],
    }));
  }

  function loadSample() {
    setResult(null);
    setInput({
      ...defaultInput(),
      contents: BROKEN_VIRELLO_SAMPLE,
      problems: SAMPLE_PROBLEMS,
      symptoms: [...SAMPLE_SYMPTOMS],
    });
    toast(t("Nai-load ang sira na Virello sample.", "Loaded the broken Virello sample."));
  }

  async function runOptimize() {
    if (!input.contents.trim()) {
      toast.error(t("I-paste muna ang laman.", "Paste the contents first."));
      return;
    }
    setResult(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 280));
    }
    const next = optimize(input);
    setResult(next);
    setStage(null);
  }

  async function copyText(id: string, body: string) {
    await navigator.clipboard.writeText(body);
    setCopied(id);
    toast.success(t("Nakopya.", "Copied."));
    setTimeout(() => setCopied(null), 1500);
  }

  const combined = useMemo(() => {
    if (!result) return "";
    return result.artifacts.map((a) => a.body).join("\n\n---\n\n");
  }, [result]);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="space-y-5">
        <div>
          <p className="text-xs tracking-[0.18em] text-foreground/50 uppercase">
            {t("Studio", "Studio")}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {t("Ayusin ang laman ng AI", "Repair the AI contents")}
          </h1>
          <p className="mt-2 text-sm text-foreground/65">
            {t(
              "I-paste ang kasalukuyang prompt o knowledge. Sasabihin namin kung ano ang sira, tapos ibibigay ang tamang spec.",
              "Paste the current prompt or knowledge. We name what is broken, then hand back a correct spec."
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product">{t("Pangalan ng AI / product", "AI / product name")}</Label>
            <Input
              id="product"
              value={input.productName}
              onChange={(e) => patch("productName", e.target.value)}
              placeholder="Virello AI Optimizer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kind">{t("Anong klase ng laman", "What kind of contents")}</Label>
            <select
              id="kind"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={input.kind}
              onChange={(e) => patch("kind", e.target.value as AIKind)}
            >
              {AI_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {lang === "fil" ? k.fil : k.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job">{t("Ano ang totoong trabaho nito", "What this AI actually does")}</Label>
          <Input
            id="job"
            value={input.productJob}
            onChange={(e) => patch("productJob", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="contents">
              {t("Kasalukuyang laman", "Current contents")}
            </Label>
            <button
              type="button"
              onClick={loadSample}
              className="text-xs underline-offset-4 hover:underline"
            >
              {t("I-load ang sira na Virello sample", "Load the broken Virello sample")}
            </button>
          </div>
          <Textarea
            id="contents"
            value={input.contents}
            onChange={(e) => patch("contents", e.target.value)}
            className="min-h-52 font-mono text-[13px] leading-relaxed"
            placeholder={t(
              "I-paste dito ang system prompt, knowledge, FAQ, o chatbot script…",
              "Paste the system prompt, knowledge, FAQ, or chatbot script…"
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Anong problema ang nararamdaman", "What is going wrong")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROBLEM_SYMPTOMS.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-foreground/10 bg-[color:var(--card)] px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={input.symptoms.includes(s.id)}
                  onCheckedChange={() => toggleSymptom(s.id)}
                />
                <span>{lang === "fil" ? s.fil : s.en}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="problems">
            {t("Detalye (opsyonal)", "Details (optional)")}
          </Label>
          <Textarea
            id="problems"
            value={input.problems}
            onChange={(e) => patch("problems", e.target.value)}
            className="min-h-24"
            placeholder={t(
              "Hal. Mali ang identity, may leftover template, empty FAQ…",
              "e.g. Wrong identity, leftover template, empty FAQ…"
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("Language ng AI", "AI language")}</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["both", t("Tumugma sa user", "Match the user")],
                ["fil", "Filipino"],
                ["en", "English"],
              ] as [ReplyLang, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => patch("language", id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  input.language === id
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 text-foreground/70"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="h-11 w-full px-5 text-base sm:w-auto"
          onClick={runOptimize}
          disabled={running}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Stethoscope className="size-4" />
          )}
          {running
            ? t(STAGES[stage ?? 0].fil, STAGES[stage ?? 0].en)
            : t("Diagnose at i-rewrite", "Diagnose and rewrite")}
        </Button>
      </section>

      <section className="min-h-[28rem] rounded-2xl border border-foreground/10 bg-[color:var(--card)] p-5 sm:p-6">
        {!result && !running ? (
          <div className="grid h-full min-h-[24rem] place-items-center text-center">
            <div className="max-w-sm">
              <Stethoscope className="mx-auto mb-4 size-8 text-foreground/35" />
              <p className="font-heading text-xl font-semibold">
                {t("Wala pang diagnosis", "No diagnosis yet")}
              </p>
              <p className="mt-2 text-sm text-foreground/60">
                {t(
                  "I-paste ang sira na laman sa kaliwa. Tatawagin namin ang mga problema sa pangalan — hindi namin itatago sa generic advice.",
                  "Paste the broken contents on the left. We will name the problems — not hide them behind generic advice."
                )}
              </p>
            </div>
          </div>
        ) : null}

        {running ? (
          <div className="grid h-full min-h-[24rem] place-items-center">
            <div className="w-full max-w-sm space-y-3">
              {STAGES.map((s, i) => (
                <div
                  key={s.en}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                    i === stage
                      ? "border-foreground bg-foreground text-background"
                      : i < (stage ?? 0)
                        ? "border-foreground/10 text-foreground/50"
                        : "border-foreground/10 text-foreground/35"
                  )}
                >
                  {i === stage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  )}
                  {t(s.fil, s.en)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {result && !running ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ScoreRing score={result.score} />
              <div>
                <p className="text-xs tracking-[0.16em] text-foreground/50 uppercase">
                  {t("Content health ng original", "Original content health")}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold leading-snug">
                  {result.identity.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                  {lang === "fil" ? result.summary.fil : result.summary.en}
                </p>
              </div>
            </div>

            {result.discarded.length > 0 ? (
              <div>
                <p className="mb-2 text-xs tracking-[0.16em] text-foreground/50 uppercase">
                  {t("Tatanggalin, hindi ituturo", "Discard, do not teach")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.discarded.map((d) => (
                    <Badge key={d} variant="outline" className="font-normal">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs tracking-[0.16em] text-foreground/50 uppercase">
                {t("Mga nahanap", "Findings")}
              </p>
              <Accordion multiple className="rounded-xl border border-foreground/10 px-3">
                {result.issues.map((issue) => (
                  <AccordionItem key={issue.code} value={issue.code}>
                    <AccordionTrigger>
                      <span className="flex items-center gap-2 pr-3 text-left">
                        <Badge
                          variant={
                            issue.severity === "critical"
                              ? "destructive"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {issue.severity}
                        </Badge>
                        <span>
                          {lang === "fil" ? issue.title.fil : issue.title.en}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-foreground/75">
                        {lang === "fil" ? issue.detail.fil : issue.detail.en}
                      </p>
                      {issue.excerpt ? (
                        <p className="mt-2 rounded-md bg-foreground/5 px-2 py-1 font-mono text-xs">
                          “{issue.excerpt}”
                        </p>
                      ) : null}
                      <p className="mt-2 text-foreground/80">
                        <span className="font-medium">
                          {t("Ayos:", "Fix:")}{" "}
                        </span>
                        {lang === "fil" ? issue.fix.fil : issue.fix.en}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {result.artifacts.length > 0 ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs tracking-[0.16em] text-foreground/50 uppercase">
                    {t("Tamang laman — kopyahin papunta sa AI mo", "Corrected contents — paste into your AI")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText("VIRELLO_OPTIMIZED_SPEC.md", combined)
                    }
                  >
                    <Download className="size-3.5" />
                    {t("I-download lahat", "Download all")}
                  </Button>
                </div>
                <Tabs defaultValue={result.artifacts[0].id}>
                  <TabsList variant="line" className="w-full justify-start overflow-x-auto">
                    {result.artifacts.map((a) => (
                      <TabsTrigger key={a.id} value={a.id}>
                        {lang === "fil" ? a.title.fil : a.title.en}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {result.artifacts.map((a) => (
                    <TabsContent key={a.id} value={a.id} className="mt-3">
                      <div className="mb-2 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyText(a.id, a.body)}
                        >
                          {copied === a.id ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {t("Kopyahin", "Copy")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadText(a.filename, a.body)}
                        >
                          <Download className="size-3.5" />
                          {a.filename}
                        </Button>
                      </div>
                      <pre className="max-h-[28rem] overflow-auto rounded-xl bg-foreground p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[color:var(--background)]">
                        {a.body}
                      </pre>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
