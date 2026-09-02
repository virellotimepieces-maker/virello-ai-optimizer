# Virello AI Optimizer

Gawing tama ang laman ng AI mo.

Virello is a content clinic for system prompts, knowledge files, FAQs, chatbot scripts, and Cursor rules. Paste what the AI uses today. Get a diagnosis and a rewritten spec it can actually follow.

## What it does

1. **Diagnose** — names placeholders, mixed identity, unanswered FAQs, fake metrics, missing language policy, and missing refusal rules.
2. **Discard** — removes unsourced numbers and features that are not this product.
3. **Rewrite** — emits four paste-ready files: `SYSTEM_PROMPT.md`, `KNOWLEDGE.md`, `GUARDRAILS.md`, `FAQ.md`.

The clinic runs in the browser. No API key. Nothing you paste is stored on a server.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43217](http://127.0.0.1:43217).

```bash
npm run build
npm start
npm test
```

## Studio

| Route | What it is |
| --- | --- |
| `/` | Home — what Virello is and how to fix AI contents |
| `/studio` | Paste the current prompt or knowledge, flag what is going wrong, then diagnose and rewrite |
| `/studio?sample=virello` | Loads a demo paste so you can see the clinic work |

How to use `/studio`:

1. Name the AI and state its real job.
2. Paste the current prompt or knowledge.
3. Check the problems you already see (wrong answers, empty FAQ, mixed identity).
4. Run **Diagnose at i-rewrite**.
5. Copy `SYSTEM_PROMPT.md` into the assistant. Put `KNOWLEDGE.md` in the knowledge file. Keep `GUARDRAILS.md` beside the prompt.

Toggle **FIL / EN** in the header. The optimizer can reply in Filipino, English, or match the user.

## Deploy on Vercel

This is a standard Next.js app. Vercel detects the framework from `vercel.json`.

1. Import the repo at [vercel.com/new](https://vercel.com/new), or use **Publish** in Cursor after Vercel is connected.
2. Framework: Next.js. Build command: `npm run build`. No extra output directory.
3. No environment variables are required. Later pushes to `main` update the same project.
