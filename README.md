# Virello AI Optimizer

Gawing tama ang laman ng AI mo.

Paste the system prompt, knowledge, FAQ, chatbot script, or Cursor rules that currently drive your AI. Virello names what is broken, discards unsourced claims, and hands back a spec the model can obey.

## What it does

1. **Diagnose** — flags placeholders, mixed identity, unanswered FAQs, fake metrics, missing language policy, and missing refusal rules.
2. **Discard** — strips leftover template copy, unsourced user counts, and features that are not this product.
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

`npm test` checks that a broken sample is diagnosed and that the rewrite no longer teaches false identity or empty FAQs.

## Studio

| Route | What it is |
| --- | --- |
| `/` | Product home: why wrong contents make an AI answer wrong |
| `/studio` | Paste contents, flag symptoms, run diagnose + rewrite |
| `/studio?sample=virello` | Loads a broken sample so you can see the clinic work |

How to use `/studio`:

1. Name the AI and state its real job.
2. Paste the current prompt or knowledge.
3. Check the problems you already see (wrong answers, leftover template, empty FAQ, and so on).
4. Run **Diagnose at i-rewrite**.
5. Copy `SYSTEM_PROMPT.md` into the assistant. Put `KNOWLEDGE.md` in the knowledge file. Keep `GUARDRAILS.md` beside the prompt.

Toggle **FIL / EN** in the header. The optimizer itself can reply in Filipino, English, or match the user.

## Deploy on Vercel

This is a standard Next.js app. Vercel detects the framework from `vercel.json`.

1. Import the repo at [vercel.com/new](https://vercel.com/new), or use **Publish** in Cursor after Vercel is connected.
2. Framework: Next.js. Build command: `npm run build`. No extra output directory.
3. No environment variables are required. Later pushes to `main` update the same project.
