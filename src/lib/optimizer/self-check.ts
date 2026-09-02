import { diagnose, scoreIssues } from "./diagnose";
import { optimize } from "./rewrite";
import { BROKEN_VIRELLO_SAMPLE, SAMPLE_PROBLEMS, SAMPLE_SYMPTOMS } from "./samples";
import type { OptimizeInput } from "./types";

const input: OptimizeInput = {
  kind: "system_prompt",
  contents: BROKEN_VIRELLO_SAMPLE,
  problems: SAMPLE_PROBLEMS,
  symptoms: SAMPLE_SYMPTOMS,
  language: "both",
  productName: "Virello AI Optimizer",
  productJob:
    "Diagnose and rewrite system prompts, knowledge, and instructions so the AI answers from correct contents.",
};

const issues = diagnose(input);
const score = scoreIssues(issues);
const result = optimize(input);

const required = [
  "wrong_product",
  "health_template_bleed",
  "framer_watermark",
  "empty_faq",
  "fake_social_proof",
] as const;

const missing = required.filter((code) => !issues.some((i) => i.code === code));
const hasHealthCrisis = result.artifacts.some((a) =>
  /preventable health crises/i.test(a.body)
);
const hasIdentity = result.artifacts[0]?.body.includes("You are Virello AI Optimizer");
const hasDiscard = result.discarded.length >= 3;

const failures: string[] = [];
if (missing.length) failures.push(`missing issue codes: ${missing.join(", ")}`);
if (score > 40) failures.push(`score too high for broken sample: ${score}`);
if (hasHealthCrisis) failures.push("rewrite still contains health-crisis copy");
if (!hasIdentity) failures.push("system prompt missing correct identity");
if (!hasDiscard) failures.push("discard list too thin");
if (result.artifacts.length !== 4) failures.push("expected 4 artifacts");

if (failures.length) {
  console.error("Virello optimizer self-check failed:");
  for (const f of failures) console.error(`- ${f}`);
  console.error(
    `score=${score} issues=${issues.map((i) => i.code).join(",")} discarded=${result.discarded.length}`
  );
  process.exit(1);
}

console.log(
  `ok score=${score} issues=${issues.length} artifacts=${result.artifacts.length} discarded=${result.discarded.length}`
);
