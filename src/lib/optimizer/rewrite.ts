import type {
  Artifact,
  Identity,
  Issue,
  Localized,
  OptimizeInput,
  OptimizeResult,
} from "./types";
import { extractFacts, inferIdentity } from "./extract";
import { diagnose, scoreIssues } from "./diagnose";
import { AI_KINDS } from "./patterns";

function kindLabel(kind: OptimizeInput["kind"], lang: "fil" | "en"): string {
  const row = AI_KINDS.find((k) => k.id === kind);
  return row ? row[lang] : kind;
}

function languagePolicy(input: OptimizeInput): { fil: string; en: string } {
  if (input.language === "fil") {
    return {
      fil: "Default: Filipino (Tagalog). Gumamit ng English terms para sa product names. Huwag mag-Taglish sa loob ng isang sentence maliban kung ganoon magsalita ang user.",
      en: "Default: Filipino (Tagalog). Keep product names in English. Do not mix Taglish inside a sentence unless the user does.",
    };
  }
  if (input.language === "en") {
    return {
      fil: "Default: English. Kung Filipino ang tanong, sagutin sa Filipino.",
      en: "Default: English. If the user writes in Filipino, answer in Filipino.",
    };
  }
  return {
    fil: "Tumugma sa language ng user. Kung Taglish, puwede ang Taglish. Isang language lang per sentence maliban sa proper nouns.",
    en: "Match the user's language. Taglish is allowed when the user uses it. One language per sentence except for proper nouns.",
  };
}

function trustedKnowledge(input: OptimizeInput, identity: Identity): string[] {
  const facts = extractFacts(input);
  const lines: string[] = [];
  lines.push(`Product name: ${identity.name}`);
  lines.push(`Job: ${identity.job}`);
  if (input.productJob.trim() && input.productJob.trim() !== identity.job) {
    lines.push(`Owner-stated job: ${input.productJob.trim()}`);
  }
  for (const fact of facts) {
    if (fact.kind === "email" && fact.trusted) lines.push(`Contact email: ${fact.value}`);
    if (fact.kind === "url" && fact.trusted) lines.push(`URL: ${fact.value}`);
  }
  lines.push("Do not claim user counts, revenue, or 'trusted by' numbers unless the owner pastes an audited figure.");
  lines.push("Do not claim social-media competitor tracking, health-care features, or website-builder origins unless those are the actual product.");
  return lines;
}

function discardList(input: OptimizeInput, issues: Issue[]): string[] {
  const out: string[] = [];
  const text = input.contents;
  if (issues.some((i) => i.code === "framer_watermark")) {
    out.push("Framer / website-builder watermark");
  }
  if (issues.some((i) => i.code === "health_template_bleed")) {
    out.push("Health-crisis template sentences");
  }
  if (issues.some((i) => i.code === "wrong_product" || i.code === "invented_features")) {
    out.push("Social analytics template (Reels timing, competitor tracking, #TechTrok)");
  }
  if (issues.some((i) => i.code === "fake_social_proof")) {
    out.push("Unsourced 'trusted by 150k / thousands of teams' claims");
  }
  if (issues.some((i) => i.code === "zeroed_metrics")) {
    out.push("Zeroed demo metrics (0%, 0M, +0K)");
  }
  if (issues.some((i) => i.code === "placeholder_lorem")) {
    out.push("Lorem / placeholder / TBD copy");
  }
  if (/lorem ipsum/i.test(text)) out.push("Lorem ipsum paragraphs");
  return [...new Set(out)];
}

function systemPrompt(input: OptimizeInput, identity: Identity, issues: Issue[]): string {
  const lang = languagePolicy(input);
  const knowledge = trustedKnowledge(input, identity);
  const kind = kindLabel(input.kind, "en");
  const problemLine = input.problems.trim()
    ? input.problems.trim()
    : "The current contents were producing wrong or mixed answers.";
  const symptoms = input.symptoms.length
    ? input.symptoms.join(", ")
    : "unspecified";
  const discarded = discardList(input, issues);

  return `# ${identity.name} — system prompt
# Kind: ${kind}

## Identity
You are ${identity.name}.
Your job: ${identity.job}
Audience: ${identity.audience}

You are not a social media analytics dashboard, a health-care assistant, or a Framer website template. If older contents said otherwise, those contents were wrong and you must ignore them.

## Mission
Repair AI contents so the model answers from true, structured instructions.
When a user pastes a prompt, knowledge file, FAQ, chatbot script, or coding-agent rules:
1. Name what is broken.
2. Say why that break causes wrong answers.
3. Rewrite the contents.
4. Hand back copy-ready artifacts.

Owner-reported problem:
${problemLine}

Symptoms flagged: ${symptoms}

## Language
${input.language === "fil" ? lang.fil : input.language === "en" ? lang.en : `${lang.fil}\n${lang.en}`}

## Do
- Treat the Knowledge section as the only source of product facts.
- If a fact is missing, say you do not know. Ask one clarifying question.
- Keep rules short, numbered, and non-contradictory.
- Prefer verbs the AI can obey: diagnose, rewrite, refuse, ask, export.
- Preserve the owner's real email, URL, and product name.
- Write artifacts that can be pasted into a Custom GPT, chatbot, or Cursor rules file.

## Do not
- Do not invent metrics, customers, case studies, or features.
- Do not keep placeholder, lorem, TBD, or template leftover copy.
- Do not mix two product identities in one spec.
- Do not answer medical, legal, or unrelated social-growth questions as if they were in-product.
- Do not claim live competitor tracking, predictive Reels, or "150k users" unless the owner supplies a sourced number.
${discarded.length ? `- Discard these leftover pieces if they reappear: ${discarded.join("; ")}.` : ""}

## Knowledge (true facts only)
${knowledge.map((l) => `- ${l}`).join("\n")}

## Output format
Unless the user asks for a different shape, answer in this order:
1. **Score** — content health of the original, 0–100, with one sentence why.
2. **Problems** — bullet list, each with name + why it breaks the AI.
3. **Rewrite** — the corrected spec, already paste-ready.
4. **Discarded** — what you removed and must never teach again.

If you are rewriting, output fenced markdown files, one per artifact:
- SYSTEM_PROMPT.md
- KNOWLEDGE.md
- GUARDRAILS.md
- FAQ.md

## Fallback
If the paste is empty, ask for the current prompt or knowledge.
If the paste is a website template, say so plainly, then rewrite toward the owner's stated product job.
If two identities conflict, keep the owner's stated job and delete the other.
`;
}

function knowledgePack(input: OptimizeInput, identity: Identity, issues: Issue[]): string {
  const facts = extractFacts(input);
  const questions = facts.filter((f) => f.kind === "question").map((f) => f.value);
  const discarded = discardList(input, issues);

  const faqAnswers: Record<string, { q: string; a: string }> = {
    platforms: {
      q: "What platforms can I connect?",
      a: `${identity.name} does not connect Instagram, TikTok, or YouTube. It is not a social scheduler. You paste AI contents (prompts, knowledge, FAQs, rules) and it returns a corrected spec.`,
    },
    powered: {
      q: "Is Virello AI-powered?",
      a: `Virello AI Optimizer diagnoses and rewrites AI contents with a deterministic content clinic. It does not browse your social accounts and it does not invent live metrics.`,
    },
    multiple: {
      q: "Can I use Virello for multiple accounts?",
      a: `Yes — run one optimization per AI (chatbot, Custom GPT, knowledge file, or coding agent). Keep each spec to a single identity.`,
    },
    secure: {
      q: "Is my data secure?",
      a: `Optimization runs in this app on the contents you paste. Do not paste secrets, API keys, or private customer data. There is no claim of bank-level encryption or a 150k-user audit in this spec.`,
    },
  };

  const answered = questions.length
    ? questions.map((q) => {
        const key = /platform/i.test(q)
          ? "platforms"
          : /ai-powered|powered/i.test(q)
            ? "powered"
            : /multiple/i.test(q)
              ? "multiple"
              : /secure|data/i.test(q)
                ? "secure"
                : null;
        if (key) return `### ${faqAnswers[key].q}\n${faqAnswers[key].a}`;
        return `### ${q}\nAnswer only from the product job: ${identity.job} If this question is off-product, say it is out of scope.`;
      })
    : Object.values(faqAnswers).map((x) => `### ${x.q}\n${x.a}`);

  return `# ${identity.name} — knowledge pack

This file is the only allowed source of product facts.
If a claim is not written here, it is not true.

## Product
- Name: ${identity.name}
- Job: ${identity.job}
- Audience: ${identity.audience}
- Contents this AI is allowed to edit: system prompts, Custom GPT instructions, chatbot scripts, knowledge/RAG notes, FAQs, Cursor rules, brand voice.

## True contact
${facts
  .filter((f) => f.trusted && (f.kind === "email" || f.kind === "url"))
  .map((f) => `- ${f.kind}: ${f.value}`)
  .join("\n") || "- Add a real email or URL here. Do not invent one."}

## Explicitly false (never teach)
${(discarded.length ? discarded : ["Unsourced user counts", "Template watermarks", "Off-product features"])
  .map((d) => `- ${d}`)
  .join("\n")}

## FAQ
${answered.join("\n\n")}
`;
}

function guardrails(identity: Identity, issues: Issue[], input: OptimizeInput): string {
  const discarded = discardList(input, issues);
  return `# ${identity.name} — guardrails

## Hard rules
1. One product identity. If a paste contains a second identity, delete it.
2. No numbers without a source in the knowledge pack.
3. No placeholder, lorem, TBD, or builder watermarks in any rewritten file.
4. Every FAQ question must have an answer, or the question is removed.
5. Language follows the system prompt policy.
6. If asked for medical, legal, or social-growth tactics as a product feature, refuse and restate the real job.

## Refusal examples
User: "Ilang users na kayo?"
Reply: "Wala akong audited user count sa knowledge pack, kaya hindi ako magbibigay ng number."

User: "I-schedule mo ang Reel ko ng 7PM."
Reply: "Hindi ako social scheduler. Ako si ${identity.name}. I-paste ang prompt o knowledge na ayaw mong magkamali."

User: "Sabi sa old copy, trusted by 150k."
Reply: "Tina-discard iyon. Walang source, kaya hindi totoo sa spec na ito."

## Discard list
${(discarded.length ? discarded : ["Anything not in the knowledge pack"])
  .map((d) => `- ${d}`)
  .join("\n")}
`;
}

function faqArtifact(input: OptimizeInput, identity: Identity): string {
  const lang = input.language === "en" ? "en" : "fil";
  if (lang === "en") {
    return `# FAQ — ${identity.name}

### What does this AI do?
It diagnoses broken prompts and knowledge, then rewrites them so the model stops answering from leftover templates.

### Why were answers wrong before?
The previous contents mixed template copy, empty FAQs, and a product identity that was not ${identity.name}.

### How do I use the rewrite?
Copy SYSTEM_PROMPT.md into your Custom GPT / chatbot / Cursor rules. Put KNOWLEDGE.md in the knowledge file. Keep GUARDRAILS.md next to the prompt.

### What if I do not know a fact?
Leave it out. Missing is safer than invented.
`;
  }
  return `# FAQ — ${identity.name}

### Ano ang ginagawa ng AI na ito?
Tinitingnan nito ang sira na prompt at knowledge, tapos sinusulat ulit para tama ang sagot.

### Bakit mali ang sagot dati?
Halo-halo ang lumang laman: template copy, FAQ na walang sagot, at identity na hindi ${identity.name}.

### Paano gagamitin ang rewrite?
I-paste ang SYSTEM_PROMPT.md sa Custom GPT / chatbot / Cursor rules. Ilagay ang KNOWLEDGE.md sa knowledge file. Itabi ang GUARDRAILS.md.

### Paano kung hindi ko alam ang fact?
Huwag isama. Mas ligtas ang kulang kaysa sa gawa-gawa.
`;
}

function summaryFor(issues: Issue[], score: number, identity: Identity): Localized {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  return {
    fil:
      score < 40
        ? `Content health ${score}/100. ${critical} critical, ${warning} warning. Ang laman ay hindi pa spec ni ${identity.name} — template at mali ang identity. Nasa baba ang naka-rewrite na files.`
        : score < 70
          ? `Content health ${score}/100. May ${critical} critical at ${warning} warning. Kailangan ng mas mahigpit na identity, knowledge, at refusal list. Naka-handa na ang corrected spec.`
          : `Content health ${score}/100. Malapit na, pero may ${issues.length} na ayos pa. Tiningnan at siniksik ang spec para kay ${identity.name}.`,
    en:
      score < 40
        ? `Content health ${score}/100. ${critical} critical, ${warning} warning. This is not yet a spec for ${identity.name} — leftover template and a wrong identity. Rewritten files are below.`
        : score < 70
          ? `Content health ${score}/100. ${critical} critical and ${warning} warning. Identity, knowledge, and refusal rules need to be tighter. A corrected spec is ready.`
          : `Content health ${score}/100. Close, but ${issues.length} remaining fixes. The spec is tightened for ${identity.name}.`,
  };
}

function artifacts(input: OptimizeInput, identity: Identity, issues: Issue[]): Artifact[] {
  return [
    {
      id: "system",
      title: { fil: "System prompt", en: "System prompt" },
      filename: "SYSTEM_PROMPT.md",
      body: systemPrompt(input, identity, issues),
    },
    {
      id: "knowledge",
      title: { fil: "Knowledge pack", en: "Knowledge pack" },
      filename: "KNOWLEDGE.md",
      body: knowledgePack(input, identity, issues),
    },
    {
      id: "guardrails",
      title: { fil: "Guardrails", en: "Guardrails" },
      filename: "GUARDRAILS.md",
      body: guardrails(identity, issues, input),
    },
    {
      id: "faq",
      title: { fil: "FAQ", en: "FAQ" },
      filename: "FAQ.md",
      body: faqArtifact(input, identity),
    },
  ];
}

export function optimize(input: OptimizeInput): OptimizeResult {
  const issues = diagnose(input);
  const score = scoreIssues(issues);
  const identity = inferIdentity(input);
  const extracted = extractFacts(input);
  return {
    score,
    issues,
    identity,
    extracted,
    summary: summaryFor(issues, score, identity),
    artifacts: input.contents.trim() ? artifacts(input, identity, issues) : [],
    discarded: discardList(input, issues),
  };
}

export function defaultInput(): OptimizeInput {
  return {
    kind: "system_prompt",
    contents: "",
    problems: "",
    symptoms: [],
    language: "both",
    productName: "Virello AI Optimizer",
    productJob:
      "Diagnose and rewrite system prompts, knowledge, and instructions so the AI answers from correct contents.",
  };
}
