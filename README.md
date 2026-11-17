# SOOUL

SOOUL is a web-first legacy and memory-preservation application.

## Stack

- React + TypeScript
- Vite
- Cloudflare Workers Static Assets
- Supabase (existing project; no schema changes in this foundation commit)

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using the existing SOOUL Supabase project's Project URL and publishable/anon key.

Never put a Supabase service-role key in a browser environment variable or commit secrets to Git.

## Build and deploy

```bash
npm run build
npx wrangler deploy
```

Cloudflare Worker configuration is in `wrangler.jsonc`. The build outputs to `dist`, which is served through Workers Static Assets.

For Cloudflare's Git integration:
- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Configure the two public Supabase Vite variables in the Cloudflare build environment before building if the frontend should initialize its Supabase client.

## Current scope

This commit establishes the frontend shell and deployment foundation only. It does not modify the existing Supabase database, authentication settings, storage buckets, or production data.
