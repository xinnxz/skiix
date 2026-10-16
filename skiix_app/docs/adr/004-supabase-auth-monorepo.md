# ADR-004: Supabase Auth as Primary Mobile Identity

> **Status:** Accepted  
> **Date:** June 5, 2026  
> **Deciders:** Luthfi Alfaridz, Furqan Zafar  
> **Supersedes:** ADR-002 (auth scope only) for `skiix_app` monorepo

---

## Context

The Expo frontend authenticates users via **Supabase Auth** (email OTP, OAuth). The backend must accept Supabase-issued access tokens without forcing a second login flow.

A legacy JWT path remains for:

- Browser OAuth (`/auth/google`)
- Older clients during transition

---

## Decision

```
Expo App ──► Supabase Auth ──► access token (ES256 JWKS)
                    │
                    ▼
            Go API BearerAuthMiddleware
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Supabase JWT verify    Legacy JWT verify
  (JWKS / HS256)         (JWT_SECRET)
        │                       │
        └───────────┬───────────┘
                    ▼
              User record (Postgres)
```

### Rules

| Rule | Detail |
|------|--------|
| Mobile primary auth | Supabase Auth only |
| API validation | `SUPABASE_URL` JWKS; optional `SUPABASE_JWT_SECRET` for HS256 legacy |
| User provisioning | Auto-link or create user row on first authenticated request |
| Server admin | `SUPABASE_SERVICE_ROLE_KEY` — OTP/signup only, never for user bearer validation |
| Legacy JWT | Kept for `/auth/*` browser flows; not required for Expo |

### Supabase products in scope

| Product | In scope? |
|---------|-----------|
| Postgres | ✅ Yes |
| Auth | ✅ Yes (mobile) |
| Edge Functions | 🟡 `supabase/functions/send-email` only |
| Realtime | ❌ No — use Firebase RTDB (ADR-001) |
| Storage | ❌ v1 — Cloudinary on backend |

---

## Consequences

### Positive

- Single sign-on experience on mobile
- No duplicate signup in Go API for Expo users
- Furqan's existing frontend auth code unchanged

### Negative

- Two auth systems to maintain during transition (Supabase + legacy JWT)
- Backend merge from standalone repo must use `BearerAuthMiddleware`, not JWT-only handlers

### Migration from standalone backend

When porting features from `xinnxz/skiix-backend`:

1. Register routes with `BearerAuthMiddleware(jwtService, supabaseAuth, userRepo)`
2. Use `OptionalBearerAuthMiddleware` only for truly public read endpoints
3. Do not require custom JWT for mobile-only flows

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Backend Lead | Luthfi Alfaridz | 2026-06-05 |
| Repo Owner | Furqan Zafar | _pending_ |
