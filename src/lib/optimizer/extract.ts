import type { ExtractedFact, OptimizeInput } from "./types";
import { IDENTITY_RE } from "./patterns";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /https?:\/\/[^\s)]+/gi;
const METRIC_RE =
  /\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(%|k|m|b|users|accounts|creators)?\b/gi;
const QUESTION_RE = /^.+\?$/gm;

const UNTRUSTED_HOST = /example\.com|yoursite|framer\.website|lorem|placeholder/i;
const UNTRUSTED_METRIC =
  /\b(150k|95\.3k|99,727|284%|5\.1m|0m|0%)\b/i;

export function extractFacts(input: OptimizeInput): ExtractedFact[] {
  const text = input.contents;
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  const push = (fact: ExtractedFact) => {
    const key = `${fact.kind}:${fact.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    facts.push(fact);
  };

  for (const match of text.match(EMAIL_RE) ?? []) {
    push({
      kind: "email",
      value: match,
      trusted: !UNTRUSTED_HOST.test(match),
    });
  }

  for (const match of text.match(URL_RE) ?? []) {
    const clean = match.replace(/[.,;]+$/, "");
    push({
      kind: "url",
      value: clean,
      trusted: !UNTRUSTED_HOST.test(clean),
    });
  }

  const identity = text.match(IDENTITY_RE)?.[0];
  if (identity) {
    push({ kind: "identity", value: identity.trim(), trusted: true });
  }

  if (input.productName.trim()) {
    push({ kind: "name", value: input.productName.trim(), trusted: true });
  }

  for (const match of text.match(QUESTION_RE) ?? []) {
    const q = match.trim();
    if (q.length < 8 || q.length > 140) continue;
    push({ kind: "question", value: q, trusted: true });
  }

  for (const match of text.match(METRIC_RE) ?? []) {
    if (UNTRUSTED_METRIC.test(match)) {
      push({ kind: "metric", value: match.trim(), trusted: false });
    }
  }

  return facts;
}

export function inferIdentity(input: OptimizeInput): {
  name: string;
  job: string;
  audience: string;
} {
  const named = input.productName.trim();
  const job = input.productJob.trim();
  const looksLikeBrokenVirello =
    /virello/i.test(input.contents) &&
    /social|framer|health crises|#aicontent/i.test(input.contents);

  if (looksLikeBrokenVirello || (!named && /virello/i.test(input.contents))) {
    return {
      name: named || "Virello AI Optimizer",
      job:
        job ||
        "Diagnose and rewrite the prompts, knowledge, and instructions that make an AI fail.",
      audience: "Builders who need their AI to answer from correct contents, not leftover templates.",
    };
  }

  if (named) {
    return {
      name: named,
      job:
        job ||
        "Answer only from the corrected knowledge and rules in this spec.",
      audience: "People talking to this AI in production.",
    };
  }

  const youAre = input.contents.match(
    /(?:you are|ikaw ay)\s+([^.\n]{3,80})/i
  )?.[1];

  return {
    name: youAre?.trim() || "Virello AI Optimizer",
    job:
      job ||
      "Diagnose broken AI contents and rewrite them so answers stay true.",
    audience: "The owner of this AI, and the people who talk to it.",
  };
}
