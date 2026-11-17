# SOOUL architecture and data model

## Deployment architecture

- **Frontend:** React + TypeScript + Vite.
- **Hosting:** Cloudflare Workers Static Assets; the Vite production bundle is generated in `dist/`.
- **Server-side endpoints:** Cloudflare Worker routes for operations that must not run with browser credentials.
- **Identity and data:** The existing SOOUL Supabase project (`kntmoexpkylnmtixgajr`).
- **Browser credentials:** Supabase publishable key only. Never place a Supabase secret/service-role key in Vite variables.

## Product areas

1. **Stories** — private memories, life events, lessons and personal narratives.
2. **Legacy** — values, wishes, letters and instructions a person wants to preserve for the future.
3. **Safekeeping** — controlled storage and retrieval of important personal records.
4. **Trusted people** — people a user may nominate for future contact or sharing, without granting access by default.

## Proposed first database objects

The public schema was inspected on 17 November 2026 and contained no tables. The following is a proposal only; it has not been applied.

### `profiles`

- `id`: UUID primary key referencing `auth.users(id)`.
- `display_name`: optional display name.
- `created_at`, `updated_at`: UTC timestamps.

### `stories`

- `id`: UUID primary key.
- `owner_id`: UUID referencing `auth.users(id)`.
- `title`: required short title.
- `body`: story content.
- `category`: controlled text category (for example memory, milestone, lesson, family history).
- `happened_on`: optional date associated with the story.
- `is_favorite`: boolean, default false.
- `created_at`, `updated_at`: UTC timestamps.

### `legacy_items`

- `id`: UUID primary key.
- `owner_id`: UUID referencing `auth.users(id)`.
- `title`: required title.
- `item_type`: controlled text type (value, wish, letter, instruction or personal record).
- `body`: content.
- `intended_recipient`: optional descriptive note, not an access grant.
- `created_at`, `updated_at`: UTC timestamps.

### `trusted_contacts`

- `id`: UUID primary key.
- `owner_id`: UUID referencing `auth.users(id)`.
- `full_name`, `email`, `relationship`: contact details.
- `status`: pending, accepted or revoked.
- `created_at`, `updated_at`: UTC timestamps.

## Security rules before any data feature ships

- Enable Row Level Security on every table in the exposed `public` schema.
- A signed-in user may read or change only rows where `owner_id = auth.uid()` (or `id = auth.uid()` for their profile).
- Do not grant trusted contacts access to Stories, Legacy items or Safekeeping files merely because they are listed as contacts.
- Use private storage buckets and owner-scoped object policies for future uploads.
- Keep service-role/secret credentials exclusively in server-side Cloudflare secrets, never in browser bundles.
- Do not build inheritance transfer, automatic release, or emergency access until the owner-verification, consent, revocation and audit model has been explicitly designed.
- Do not store highly sensitive identity or financial documents until encryption, retention, deletion, recovery and access auditing are specified.

## Current implementation status

- React/Vite/TypeScript foundation: committed.
- Cloudflare Worker static-asset deployment configuration: committed.
- Supabase browser client: initialized with publishable-key support.
- Email/password sign-up, sign-in and password-reset interface: committed.
- Authenticated member-space placeholder: committed.
- Public schema inspection: no tables found; no schema changes made.
- Security, performance and health advisor checks: no findings returned.
- Stories and Legacy schema: proposed only; awaiting product confirmation before applying database changes.
