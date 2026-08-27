# Virello AI Optimizer

Full deploy-ready Next.js source project for e-commerce product optimization.

Includes product title, description, keywords, SEO title, meta description, bulk optimization, CSV import/export, responsive dashboard, and an optional OpenAI-compatible AI API route.

## Run
npm install
npm run dev

## Optional AI environment
AI_API_KEY=your_key
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini

## Required production environment
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_REDIRECT_URI=https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback
SHOPIFY_SCOPES=read_products,write_products
STRIPE_SECRET_KEY=...
STRIPE_PRICE_ID=...
SUBSCRIBER_COOKIE_SECRET=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
AI_SUBSCRIBER_USAGE_LIMIT=100

Without an API key, the built-in local optimizer works.

## Deploy
Upload the EXTRACTED contents of this project to GitHub, connect the repository to Vercel, then deploy.
