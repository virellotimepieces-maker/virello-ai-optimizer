import type { Issue, OptimizeInput } from "./types";
import {
  FAKE_PROOF_RE,
  FLUFF_RE,
  FRAMER_RE,
  HEALTH_BLEED_RE,
  IDENTITY_RE,
  INVENTED_FEATURE_RE,
  LANGUAGE_POLICY_RE,
  OUTPUT_FORMAT_RE,
  PLACEHOLDER_RE,
  REFUSAL_RE,
  SOCIAL_TEMPLATE_RE,
  TYPO_RE,
  ZERO_METRIC_RE,
} from "./patterns";

function excerpt(text: string, re: RegExp): string | undefined {
  const match = text.match(re);
  return match?.[0]?.slice(0, 180);
}

function duplicateLines(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 24);
  const seen = new Map<string, number>();
  for (const line of lines) {
    const key = line.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if ((seen.get(key) ?? 0) >= 2) return line.slice(0, 180);
  }
  return undefined;
}

function unansweredQuestions(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim());
  const faqIndex = lines.findIndex((l) => /^faq\b|^frequently asked/i.test(l));
  const block = faqIndex === -1 ? lines : lines.slice(faqIndex + 1);
  const questions = block.filter((l) => l.endsWith("?") && l.length > 8);
  if (questions.length < 2 && faqIndex === -1) return undefined;
  if (questions.length === 0) return undefined;

  let unanswered = 0;
  for (let i = 0; i < block.length; i++) {
    if (!block[i].endsWith("?")) continue;
    const next = block.slice(i + 1).find((l) => l.length > 0);
    const nextIsNotAnswer =
      !next ||
      next.endsWith("?") ||
      /^(#{1,3}\s|contact:|leverage |create a free|trusted by)/i.test(next);
    if (nextIsNotAnswer) unanswered += 1;
  }

  if (unanswered >= Math.max(1, Math.ceil(questions.length * 0.5))) {
    return questions[0];
  }
  return undefined;
}

export function diagnose(input: OptimizeInput): Issue[] {
  const text = input.contents.trim();
  const issues: Issue[] = [];
  const joinedProblems = `${input.problems} ${input.symptoms.join(" ")}`.toLowerCase();

  if (!text) {
    issues.push({
      code: "empty_contents",
      severity: "critical",
      title: {
        fil: "Walang laman",
        en: "No contents",
      },
      detail: {
        fil: "Walang prompt, knowledge, o instructions na pwede ayusin.",
        en: "There is no prompt, knowledge, or instructions to repair.",
      },
      fix: {
        fil: "I-paste ang kasalukuyang system prompt o knowledge ng AI.",
        en: "Paste the current system prompt or knowledge of the AI.",
      },
    });
    return issues;
  }

  if (text.length < 80) {
    issues.push({
      code: "too_short",
      severity: "critical",
      title: { fil: "Masyadong maikli", en: "Too short to run an AI" },
      detail: {
        fil: "Ang laman ay kulang para maging identity, rules, at knowledge.",
        en: "This is too thin to serve as identity, rules, and knowledge.",
      },
      excerpt: text.slice(0, 180),
      fix: {
        fil: "Dagdagan ng kung sino ang AI, ano ang trabaho, at ano lang ang totoo.",
        en: "Add who the AI is, what it does, and which facts are true.",
      },
    });
  }

  if (PLACEHOLDER_RE.test(text)) {
    issues.push({
      code: "placeholder_lorem",
      severity: "critical",
      title: { fil: "May placeholder o lorem", en: "Placeholder or lorem text" },
      detail: {
        fil: "May dummy copy pa. Kapag binasa ito ng AI, ito rin ang isasagot.",
        en: "Dummy copy is still inside. The AI will treat it as truth.",
      },
      excerpt: excerpt(text, PLACEHOLDER_RE),
      fix: {
        fil: "Tanggalin lahat ng lorem, TBD, at insert-here. Palitan ng totoong facts.",
        en: "Remove lorem, TBD, and insert-here. Replace with real facts.",
      },
    });
  }

  if (FRAMER_RE.test(text)) {
    issues.push({
      code: "framer_watermark",
      severity: "critical",
      title: { fil: "Framer template watermark", en: "Framer template watermark" },
      detail: {
        fil: "Website builder leftover ito, hindi product copy. Nililito nito ang AI kung ano kayo.",
        en: "This is website-builder leftover, not product copy. It confuses the AI about who you are.",
      },
      excerpt: excerpt(text, FRAMER_RE),
      fix: {
        fil: "Alisin ang Framer line. Ilagay ang totoong product at contact na lang.",
        en: "Delete the Framer line. Keep only the real product and contact.",
      },
    });
  }

  if (HEALTH_BLEED_RE.test(text)) {
    issues.push({
      code: "health_template_bleed",
      severity: "critical",
      title: {
        fil: "Health-template ang nakapasok",
        en: "Health-template copy leaked in",
      },
      detail: {
        fil: "May 'preventable health crises' o clinical copy. Hindi ito parte ng Virello.",
        en: "Health-crisis copy is sitting in the spec. It does not belong to this product.",
      },
      excerpt: excerpt(text, HEALTH_BLEED_RE),
      fix: {
        fil: "Burahin ang health copy. Huwag iwanan kahit isang sentence.",
        en: "Delete the health copy. Do not leave a single sentence.",
      },
    });
  }

  const social = SOCIAL_TEMPLATE_RE.test(text);
  const wantsOptimizer =
    /optimizer|system prompt|knowledge|instructions|ayusin ang (ai|laman)/i.test(
      `${input.productJob} ${input.productName} ${input.problems}`
    ) ||
    /virello/i.test(input.productName) ||
    input.symptoms.includes("mixed_identity");

  if (social && wantsOptimizer) {
    issues.push({
      code: "wrong_product",
      severity: "critical",
      title: {
        fil: "Mali ang product identity",
        en: "Wrong product identity",
      },
      detail: {
        fil: "Social media analytics template ang laman, pero AI Optimizer ang dapat na product.",
        en: "The contents describe a social analytics template, but the product is an AI Optimizer.",
      },
      excerpt: excerpt(text, SOCIAL_TEMPLATE_RE),
      fix: {
        fil: "Palitan ang identity: Virello ay nag-aayos ng laman ng AI, hindi nagtatrack ng Reels.",
        en: "Replace the identity: Virello repairs AI contents, it does not track Reels.",
      },
    });
  } else if (social && /optimizer|chatbot|prompt/i.test(text)) {
    issues.push({
      code: "contradictory_identity",
      severity: "critical",
      title: { fil: "Dalawang identity", en: "Two product identities" },
      detail: {
        fil: "Social dashboard at AI optimizer sabay nakasulat. Hindi alam ng model kung sino siya.",
        en: "A social dashboard and an AI optimizer are both claimed. The model cannot tell who it is.",
      },
      excerpt: excerpt(text, SOCIAL_TEMPLATE_RE),
      fix: {
        fil: "Pumili ng iisang job. Burahin ang identity na hindi totoo.",
        en: "Pick one job. Delete the identity that is not true.",
      },
    });
  }

  if (HEALTH_BLEED_RE.test(text) && social) {
    issues.push({
      code: "contradictory_identity",
      severity: "critical",
      title: { fil: "Halo-halong template", en: "Mixed leftover templates" },
      detail: {
        fil: "Social analytics at health copy magkasama. Dalawang template, walang totoong product.",
        en: "Social analytics and health copy sit together. Two templates, no real product.",
      },
      fix: {
        fil: "Isang identity lang: kung ano talaga ang ginagawa ng AI.",
        en: "Keep a single identity: what the AI actually does.",
      },
    });
  }

  const unanswered = unansweredQuestions(text);
  if (unanswered) {
    issues.push({
      code: "empty_faq",
      severity: "critical",
      title: { fil: "FAQ walang sagot", en: "FAQ has no answers" },
      detail: {
        fil: "May mga tanong pero walang sagot sa ilalim. Gagawa ng sagot ang AI.",
        en: "Questions are listed with no answers under them. The AI will invent replies.",
      },
      excerpt: unanswered,
      fix: {
        fil: "Sagutin ang bawat tanong gamit ang totoong policy, o tanggalin ang tanong.",
        en: "Answer every question with a real policy, or delete the question.",
      },
    });
  }

  if (FAKE_PROOF_RE.test(text)) {
    issues.push({
      code: "fake_social_proof",
      severity: "warning",
      title: { fil: "Hindi mapatunayan na social proof", en: "Unverified social proof" },
      detail: {
        fil: "May 'trusted by 150k' o 'thousands of teams' na walang source. Huwag ituro ito sa AI.",
        en: "'Trusted by 150k' or 'thousands of teams' has no source. Do not teach it to the AI.",
      },
      excerpt: excerpt(text, FAKE_PROOF_RE),
      fix: {
        fil: "Alisin ang inflated numbers. Kung walang audit, huwag isama.",
        en: "Remove inflated counts. If it is not audited, it does not belong in knowledge.",
      },
    });
  }

  if (ZERO_METRIC_RE.test(text)) {
    issues.push({
      code: "zeroed_metrics",
      severity: "warning",
      title: { fil: "Zeroed dummy metrics", en: "Zeroed dummy metrics" },
      detail: {
        fil: "May 0%, 0M, o +0K. Demo numbers ito, hindi performance.",
        en: "0%, 0M, or +0K are demo numbers, not performance.",
      },
      excerpt: excerpt(text, ZERO_METRIC_RE),
      fix: {
        fil: "Huwag ilagay ang metrics kung wala pang totoong data.",
        en: "Do not put metrics in knowledge until they are real.",
      },
    });
  }

  if (FLUFF_RE.test(text)) {
    issues.push({
      code: "generic_saas_fluff",
      severity: "warning",
      title: { fil: "Generic SaaS fluff", en: "Generic SaaS fluff" },
      detail: {
        fil: "Cutting-edge, transform your business, billions of data points — walang specific job.",
        en: "Cutting-edge, transform your business, billions of data points — no specific job.",
      },
      excerpt: excerpt(text, FLUFF_RE),
      fix: {
        fil: "Palitan ng konkretong ginagawa: diagnose, rewrite, export.",
        en: "Replace with concrete work: diagnose, rewrite, export.",
      },
    });
  }

  if (INVENTED_FEATURE_RE.test(text) && wantsOptimizer) {
    issues.push({
      code: "invented_features",
      severity: "critical",
      title: { fil: "Features na hindi sa'yo", en: "Features that are not yours" },
      detail: {
        fil: "May predictive Reels, competitor tracking, o ibang product features na wala sa Optimizer.",
        en: "Predictive Reels, competitor tracking, or other product features do not belong to the Optimizer.",
      },
      excerpt: excerpt(text, INVENTED_FEATURE_RE),
      fix: {
        fil: "Ituro lang ang features na talagang ginagawa ng tool.",
        en: "Teach only features the tool actually performs.",
      },
    });
  }

  if (TYPO_RE.test(text)) {
    issues.push({
      code: "typos_and_gibberish",
      severity: "warning",
      title: { fil: "Typo o gibberish", en: "Typos or gibberish" },
      detail: {
        fil: "May maling spelling gaya ng Countires o TechTrok. Uulitin ito ng AI.",
        en: "Misspellings such as Countires or TechTrok will be repeated by the AI.",
      },
      excerpt: excerpt(text, TYPO_RE),
      fix: {
        fil: "Ayusin ang spelling o tanggalin ang hashtag na gawa-gawa.",
        en: "Fix the spelling or delete invented hashtags.",
      },
    });
  }

  const dup = duplicateLines(text);
  if (dup) {
    issues.push({
      code: "duplicate_blocks",
      severity: "info",
      title: { fil: "Ulit-ulit na block", en: "Duplicated blocks" },
      detail: {
        fil: "May parehong sentence nang dalawang beses. Template paste ito.",
        en: "The same sentence appears twice. That is a template paste.",
      },
      excerpt: dup,
      fix: {
        fil: "Isang copy lang ng bawat rule.",
        en: "Keep a single copy of each rule.",
      },
    });
  }

  const needsIdentity =
    input.kind === "system_prompt" ||
    input.kind === "custom_gpt" ||
    input.kind === "chatbot" ||
    input.kind === "cursor_rules";

  if (needsIdentity && !IDENTITY_RE.test(text) && !input.productName.trim()) {
    issues.push({
      code: "missing_identity",
      severity: "critical",
      title: { fil: "Walang malinaw na 'You are'", en: "No clear 'You are'" },
      detail: {
        fil: "Hindi sinasabi kung sino ang AI. Mag-iimbento siya ng persona.",
        en: "The spec never says who the AI is. It will invent a persona.",
      },
      fix: {
        fil: "Simulan sa: You are {pangalan}. Trabaho mo ay {job}.",
        en: "Start with: You are {name}. Your job is {job}.",
      },
    });
  }

  if (!LANGUAGE_POLICY_RE.test(text) && (input.language !== "en" || joinedProblems.includes("language"))) {
    issues.push({
      code: "missing_language_policy",
      severity: "warning",
      title: { fil: "Walang language policy", en: "No language policy" },
      detail: {
        fil: "Hindi sinasabi kung Filipino, English, o pareho. Magiging halo-halo ang sagot.",
        en: "It never says Filipino, English, or both. Replies will mix without a rule.",
      },
      fix: {
        fil: "Maglagay ng default language at kailan magpapalit.",
        en: "Set a default language and when to switch.",
      },
    });
  }

  if (needsIdentity && !OUTPUT_FORMAT_RE.test(text)) {
    issues.push({
      code: "missing_output_format",
      severity: "warning",
      title: { fil: "Walang output format", en: "No output format" },
      detail: {
        fil: "Hindi defined kung paano dapat magmukha ang sagot. Magiging random ang shape.",
        en: "The reply shape is undefined, so the AI will improvise structure.",
      },
      fix: {
        fil: "Ilista ang sections: diagnosis, rewrite, export.",
        en: "List the sections: diagnosis, rewrite, export.",
      },
    });
  }

  if (needsIdentity && !REFUSAL_RE.test(text)) {
    issues.push({
      code: "missing_refusal",
      severity: "warning",
      title: { fil: "Walang refusal / huwag", en: "No refusal rules" },
      detail: {
        fil: "Walang listahan ng huwag. Kaya nagsasabi ng features at numbers na wala.",
        en: "There is no do-not list, so the AI invents features and numbers.",
      },
      fix: {
        fil: "Idagdag: huwag mag-imbento ng metrics, features, o customers.",
        en: "Add: do not invent metrics, features, or customers.",
      },
    });
  }

  const headingCount = (text.match(/^#{1,3}\s|^\d+\.\s|^[-*]\s/gm) ?? []).length;
  if (text.length > 1200 && headingCount < 4) {
    issues.push({
      code: "unstructured_wall",
      severity: "info",
      title: { fil: "Isang pader ng text", en: "Unstructured wall of text" },
      detail: {
        fil: "Mahaba pero walang sections. Mahirap sundin, madaling kalimutan ang rules.",
        en: "It is long but has almost no sections, so rules get dropped.",
      },
      fix: {
        fil: "Hatiin: Identity, Job, Language, Do, Don't, Knowledge, Output.",
        en: "Split into Identity, Job, Language, Do, Don't, Knowledge, Output.",
      },
    });
  }

  if (input.symptoms.includes("wrong_answers") || /hallucin|gawa-gawa|mali ang sagot/i.test(input.problems)) {
    const already = issues.some((i) => i.code === "missing_refusal" || i.code === "wrong_product");
    if (!already) {
      issues.push({
        code: "off_topic_content",
        severity: "warning",
        title: {
          fil: "Knowledge na pwedeng magpalito",
          en: "Knowledge that can mislead",
        },
        detail: {
          fil: "Sabi mo mali ang sagot. Ang laman ay may claims na walang source.",
          en: "You reported wrong answers. The contents still include unsourced claims.",
        },
        fix: {
          fil: "Knowledge = facts lang na sinabi mo. Lahat ng iba, 'hindi ko alam'.",
          en: "Knowledge = only facts you stated. Everything else is 'I don't know'.",
        },
      });
    }
  }

  const unique = new Map<string, Issue>();
  for (const issue of issues) {
    if (!unique.has(issue.code)) unique.set(issue.code, issue);
  }
  return [...unique.values()];
}

export function scoreIssues(issues: Issue[]): number {
  if (issues.some((i) => i.code === "empty_contents")) return 4;
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 12;
    else if (issue.severity === "warning") score -= 6;
    else score -= 3;
  }
  return Math.max(6, Math.min(96, score));
}
