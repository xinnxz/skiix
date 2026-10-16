# ADR-002: Supabase Scope — Postgres Hosting Only (Legacy)

> **Status:** Superseded by [ADR-004](./004-supabase-auth-monorepo.md) in this monorepo  
> **Date:** June 5, 2026  
> **Original context:** `xinnxz/skiix-backend` standalone API

---

## Original decision (standalone backend)

Use Supabase **only** as managed PostgreSQL. Do not use Supabase Auth, Realtime, Storage, or Edge Functions in the Go API.

Auth was custom JWT (`JWT_SECRET` + refresh tokens).

---

## Why superseded

The `skiix_app` monorepo ships with:

- Expo frontend using **Supabase Auth** (`@supabase/supabase-js`)
- Backend `BearerAuthMiddleware` validating Supabase access tokens via JWKS
- `supabase/` folder for edge functions

That is intentional for mobile MVP velocity. See ADR-004.

---

## What still applies

- PostgreSQL remains the **canonical store** for business data
- Prefer `DATABASE_URL` pooler connection
- Firebase (not Supabase Realtime) for live chat stream per ADR-001
