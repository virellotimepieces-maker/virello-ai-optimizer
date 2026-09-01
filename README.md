# Virello AI Optimizer

Full deploy-ready Next.js source project for e-commerce product optimization.

Includes product title, description, keywords, SEO title, meta description, bulk optimization, CSV import/export, responsive dashboard, and an optional OpenAI-compatible AI API route.

## Run
npm install
npm run dev

## Production environment

Configure these variables in Vercel before accepting subscribers:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUBSCRIBER_COOKIE_SECRET=a-long-random-secret
DATABASE_URL=postgresql://...
AI_SUBSCRIBER_USAGE_LIMIT=100
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_TOKEN_ENCRYPTION_KEY=at-least-32-random-characters
```

Run `migrations/001_subscriber_usage.sql` once against `DATABASE_URL` before launch.

The Shopify token encryption key must remain stable after stores connect. Changing it invalidates existing encrypted Shopify sessions and requires merchants to reconnect.

In Stripe, configure the production webhook endpoint as
`https://virello-ai-optimizer.vercel.app/api/stripe/webhook` and subscribe to checkout,
subscription, and invoice events.

## Deploy
Upload the EXTRACTED contents of this project to GitHub, connect the repository to Vercel, then deploy.
