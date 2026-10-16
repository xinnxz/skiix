# Production Deployment Checklist — Skiix Monorepo

> **Audience:** Furqan Zafar (DevOps), Luthfi Alfaridz (Backend)  
> **Date:** June 5, 2026  
> **Repo:** `furqan137/skiix_app`  
> **Related:** ADR-001, ADR-003, ADR-004

---

## Pre-deploy (one-time setup)

### 1. Repository

- [ ] CI green on `main`: backend lint · test · build · frontend lint
- [ ] Branch protection on `main`
- [ ] Epic 2 Mood Feed merged (Phase 1) — see [02-backend-merge-plan.md](./02-backend-merge-plan.md)

### 2. Secrets — rotate before first production deploy

> **Critical:** JWT secret was shared in WhatsApp. Generate new values.

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

- [ ] `JWT_SECRET` rotated (hosting secrets only)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not in git or chat
- [ ] `DATABASE_URL` from secret manager
- [ ] No secrets in git, WhatsApp, or Notion

See [03-security-secret-rotation.md](./03-security-secret-rotation.md).

### 3. Database (PostgreSQL 16)

- [ ] Supabase project or managed Postgres provisioned
- [ ] `DATABASE_URL` pooler URI configured (IPv4-friendly)
- [ ] SSL enforced (`sslmode=require`)
- [ ] Migrations run on first deploy (`migration.RunMigrations` in `main.go`)

### 4. Supabase Auth

- [ ] `SUPABASE_URL` set on backend
- [ ] JWKS verification working (ES256 tokens from mobile)
- [ ] OTP / Resend configured if using email signup (`RESEND_API_KEY`)

### 5. Firebase

- [ ] Firebase project (iOS + Android apps)
- [ ] Service account JSON mounted at `FIREBASE_CREDENTIALS_PATH`
- [ ] FCM tested
- [ ] RTDB rules configured per ADR-001

---

## Environment variables (backend production)

Template: `backend/.env.example`

| Variable | Required | Notes |
|----------|----------|-------|
| `BASE_URL` | ✅ | `https://api.<domain>` |
| `DATABASE_URL` | ✅ | Supabase pooler URI |
| `SUPABASE_URL` | ✅ | JWKS for mobile tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server OTP/admin only |
| `JWT_SECRET` | ✅ | Legacy auth + rotation |
| `FIREBASE_CREDENTIALS_PATH` | ✅ prod | FCM + RTDB token |
| `RESEND_API_KEY` | If OTP signup | |
| `CLOUDINARY_*` | If uploads | |

Frontend: `frontend/.env.example` — `EXPO_PUBLIC_SUPABASE_URL`, API base URL.

---

## Build & run

```bash
cd backend
CGO_ENABLED=0 go build -o bin/skiix ./cmd/skiix/
./bin/skiix
```

---

## Smoke test (post-deploy)

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /swagger/index.html` | 200 |
| 2 | Mobile login via Supabase | Session in app |
| 3 | `GET /api/v1/feed` with Supabase bearer | 200 |
| 4 | `GET /api/v1/moods` | 200 (after Phase 1 merge) |
| 5 | `GET /api/v1/chat/auth-token` | Firebase custom token |
| 6 | FCM push on like/comment | Device receives notification |

---

## Architecture alignment

| Decision | Document |
|----------|----------|
| Chat hybrid | [ADR-001](../adr/001-chat-firebase-vs-postgres.md) |
| Supabase Auth | [ADR-004](../adr/004-supabase-auth-monorepo.md) |
| Repo handoff | [ADR-003](../adr/003-repo-migration-handoff.md) |

---

## Contacts

| Role | Name |
|------|------|
| Backend | Luthfi Alfaridz |
| DevOps | Furqan Zafar |
| Mobile | _TBD_ |

---

*Checklist version 2.0 — monorepo edition.*
