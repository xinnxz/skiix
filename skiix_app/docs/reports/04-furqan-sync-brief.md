# Infrastructure Decisions — Furqan Sync Brief

> **Date:** June 5, 2026  
> **From:** Luthfi Alfaridz (Backend)  
> **To:** Furqan Zafar, Mobile + FE leads  
> **Repo:** `furqan137/skiix_app` (canonical)

---

## Executive summary (30 seconds)

Development now runs in **`furqan137/skiix_app`**. Mobile uses **Supabase Auth**; Postgres holds business data; Firebase handles push + real-time chat (ADR-001). Epic 2 Mood Feed is being merged into `backend/`. **Rotate JWT secrets** before production — values shared in WhatsApp are compromised.

---

## Decisions (monorepo)

| # | Decision | ADR |
|---|----------|-----|
| 1 | Firebase for FCM + RTDB chat | [001](../adr/001-chat-firebase-vs-postgres.md) |
| 2 | Supabase Auth on mobile + Postgres | [004](../adr/004-supabase-auth-monorepo.md) |
| 3 | This repo is canonical; archive old backend after merge | [003](../adr/003-repo-migration-handoff.md) |
| 4 | Rotate all production secrets before deploy | [03](./03-security-secret-rotation.md) |

---

## What changed vs WhatsApp discussion

| Topic | WhatsApp | Monorepo reality |
|-------|----------|------------------|
| Supabase | "Some features" | **Auth + Postgres** on mobile (ADR-004) |
| Backend repo | Push to Furqan's repo | ✅ Now working in `skiix_app` |
| Firebase auth | Login/signup via Firebase | **Supabase Auth** for login; Firebase for chat/push |

---

## Backend env (production minimum)

```env
BASE_URL=https://api.<domain>
DATABASE_URL=postgresql://...
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret-manager>
JWT_SECRET=<new — rotated>
FIREBASE_CREDENTIALS_PATH=/app/firebase-credentials.json
```

Full checklist: [05-deployment-checklist.md](./05-deployment-checklist.md)

---

## Open items for Furqan

| # | Item | Priority |
|---|------|----------|
| 1 | Enable branch protection + CI on `main` | P0 |
| 2 | Rotate JWT + service role keys | P0 |
| 3 | Ack ADR-004 (Supabase Auth) | P1 |
| 4 | Staging Postgres for merge testing | P1 |
| 5 | Review RTDB security rules | P1 |

---

## Open items for mobile

| # | Item | Priority |
|---|------|----------|
| 1 | Mood Feed UI after Phase 1 merge | P0 |
| 2 | Chat dual-write Postgres + RTDB | P0 |
| 3 | FCM device register on login | P1 |

---

## Suggested WhatsApp reply

> Repo canonical sekarang `furqan137/skiix_app` — sudah ada README, CI, ADR, dan merge plan buat Mood Feed.
> Auth mobile tetap Supabase; Firebase buat push + chat real-time.
> Backend epic-2 lagi di-merge ke folder `backend/`.
> JWT secret kita rotate ya sebelum deploy.
> Branch pertama: `feature/monorepo-foundation` → PR ke main.

---

*Brief version 2.0 — monorepo edition.*
