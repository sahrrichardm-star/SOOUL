# SOOUL

SOOUL is a web-first legacy and memory-preservation application.

## Stack

- React + TypeScript
- Vite
- Cloudflare Workers Static Assets
- Supabase Auth and Postgres (existing SOOUL project)

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using the existing SOOUL Supabase project's Project URL and publishable key. A legacy anon key is supported as a fallback.

Never put a Supabase secret or service-role key in a browser environment variable or commit secrets to Git.

## Cloudflare build configuration

- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Add these two **build environment variables** in the Cloudflare Workers & Pages project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

These are Vite build-time values. After adding them, trigger a new deployment so the frontend bundle is rebuilt with the existing SOOUL Supabase project configuration.

## Supabase Auth redirect configuration

In the existing SOOUL Supabase project, add the deployed Worker origin to Authentication → URL Configuration → Redirect URLs:

`https://sooul.sahrrichardm.workers.dev/**`

Also add your eventual custom domain there when one is configured. The application uses the current site origin as the email confirmation and password-reset redirect.

## Build and deploy

```bash
npm run build
npx wrangler deploy
```

Cloudflare Worker configuration is in `wrangler.jsonc`. The build outputs to `dist`, which is served through Workers Static Assets.

## Current scope

The current milestone establishes the responsive brand landing page and email/password authentication UI. The public database schema was inspected and is currently empty. No existing Supabase tables, users, storage buckets, authentication settings, or production records have been changed. The member area is a safe starting shell; Stories, Legacy, and Safekeeping data features are the next implementation milestones.
