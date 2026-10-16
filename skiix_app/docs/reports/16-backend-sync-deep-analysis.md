# Backend Sync Deep Analysis — `skiix-backend` → `skiix_app`

> **Date:** June 7, 2026  
> **Source (reference):** `xinnxz/skiix-backend` @ `main` / `feature/epic-2-completion`  
> **Target (canonical):** `furqan137/skiix_app/backend` @ `main`  
> **Owner:** Luthfi Alfaridz  
> **Related:** [02-backend-merge-plan.md](./02-backend-merge-plan.md), [15-conflict-free-collaboration-plan.md](./15-conflict-free-collaboration-plan.md), ADR-003, ADR-004

---

## Executive summary

The two backends are **not duplicates** — they are **forked products** that share a core (circles, focus mode, feed limits, posts, mood schema) but diverged on auth, chat, social graph, and mobile features.

**Already synced (~40% of Epic 2 value):** Mood Feed API, monorepo foundation, CEO 3/9 tiers, Supabase auth wiring on new routes, docs/ADRs.

**Still missing from monorepo (~60% Epic 2 + production hardening):** Redis, waitlist, notifications, search, integration tests, production middleware, quiet hours, Epic social graph, Postgres chat CRUD.

**Rule:** **Integrate, don't overwrite.** Never copy `skiix-backend` wholesale onto `skiix_app`.

---

## What we discussed before (traceability)

| Document | Decision | Current status |
|----------|----------|----------------|
| [02-backend-merge-plan.md](./02-backend-merge-plan.md) | Incremental port, not big-bang | Phase 0–1 ✅, Phase 2–4 🔲 |
| [11-infra-decisions-furqan-sync.md](./04-furqan-sync-brief.md) | Supabase Auth + Firebase hybrid | ✅ ADR-004 in monorepo |
| [ADR-001](../adr/001-chat-firebase-vs-postgres.md) | Postgres canonical + Firebase RTDB | Monorepo uses Supabase DM + Firebase token |
| [ADR-003](../adr/003-repo-migration-handoff.md) | `skiix_app` = canonical repo | ✅ Work on `main`/`develop` |
| [15-conflict-free-collaboration-plan.md](./15-conflict-free-collaboration-plan.md) | PR → `develop`, folder ownership | ✅ `develop` branch created |
| WhatsApp (Furqan) | Test with app running, no break API | ✅ moods optional on post create |

---

## Repository snapshot

| | `skiix-backend` | `skiix_app/backend` |
|---|-----------------|---------------------|
| **Role** | Epic 2 reference / archive candidate | Canonical for mobile + deploy |
| **Go files** | ~115 | ~84 |
| **Module** | `github.com/skiix-backend` | Same |
| **Auth** | Custom JWT + Redis rate limit | Supabase JWT + legacy JWT + OTP |
| **Chat** | Postgres conversations API | Supabase DM + WebSocket + Firebase token |
| **Mobile extras** | — | Reels, explore, stories, Cloudinary, AI |
| **Production ops** | Redis, Sentry, PostHog, health, graceful shutdown | Minimal (`gin.Default`) |
| **Tests** | 14+ integration tests + CI Postgres | Unit tests only |

---

## Sync matrix by feature

| Feature | Source | Target | Sync status | Action |
|---------|--------|--------|-------------|--------|
| **Mood Feed** | ✅ Full PRD-12 | ✅ Ported + CEO 3/9 | **DONE** | Juan: mobile UI |
| **Circles** | ✅ | ✅ | **DONE** | — |
| **Focus mode** | ✅ | ✅ | **DONE** | — |
| **Feed limits** | ✅ | ✅ | **DONE** | — |
| **Posts CRUD** | ✅ | ✅ (extended types) | **PARTIAL** | Keep target post types |
| **Supabase Auth** | ❌ | ✅ | **Target only** | Do not port JWT-only auth |
| **OTP / Resend** | ❌ | ✅ | **Target only** | Keep |
| **Reels / Explore** | ❌ | ✅ | **Target only** | Keep |
| **Stories / Connections** | ❌ | ✅ | **Target only** | Keep |
| **Cloudinary / AI** | ❌ | ✅ | **Target only** | Keep |
| **WebSocket DM** | ❌ | ✅ | **Target only** | Keep |
| **Redis + rate limit** | ✅ | ❌ | **MISSING** | Phase A port |
| **Waitlist** | ✅ | ❌ | **MISSING** | Phase B port |
| **Notifications** | ✅ | ❌ | **MISSING** | Phase B port |
| **Search + trending** | ✅ | ❌ partial | **MISSING** | Phase B (vs explore) |
| **Quiet hours** | ✅ | ❌ | **MISSING** | Phase B port |
| **Integration tests** | ✅ 14 files | ❌ | **MISSING** | Phase C port |
| **Health + graceful shutdown** | ✅ | ❌ | **MISSING** | Phase A port |
| **CORS / security middleware** | ✅ | ❌ | **MISSING** | Phase A port |
| **Postgres chat CRUD** | ✅ | ❌ (Supabase DM) | **RESOLVED** | ADR-005: keep Supabase DM |
| **Social graph** | `user_follows` / blocks | `followers` / connections | **RESOLVED** | ADR-005: Furqan model |
| **Bookmarks** | `post_bookmarks` / reposts | `saves` + workspace | **RESOLVED** | ADR-005: keep `saves` |
| **Feed URL** | `GET /feeds` | `GET /feed` | **RESOLVED** | ADR-005: `/feed` only |

---

## Already synced (evidence)

| Item | Evidence in `skiix_app` |
|------|-------------------------|
| Mood domain + usecase + repo + handler | `internal/domain/mood*.go`, `usecase/mood.go`, `repository/mood_repository.go`, `delivery/http/mood_handler.go` |
| Mood migrations | `post_moods`, `mood_schedules`, `mood_sessions` in `pkg/migration/migration.go` |
| Mood on posts | `post.go` usecase/repo — optional `moods`, `?mood=` filter |
| CEO 3 free / 9 Pro | `domain/mood.go` BasePostMoods = sad, chill, hype |
| Supabase on mood/chat/device | `BearerAuthMiddleware` in `routes.go` |
| Monorepo docs + CI | `README.md`, `.github/workflows/ci.yml`, `docs/adr/`, `docs/reports/` |
| Conflict workflow | `develop` branch, doc 15 |

---

## Missing from monorepo (must port from source)

### P0 — Production foundation (no mobile break)

| Component | Source paths |
|-----------|--------------|
| Redis client | `internal/infrastructure/redis.go` |
| Rate limiting | `internal/delivery/http/rate_limiter.go` |
| CORS + security headers | `cors_middleware.go`, `security_middleware.go` |
| Request ID + logging | `request_id_middleware.go`, `logging_middleware.go`, `pkg/logger/` |
| Health check | `health_handler.go` → `GET /health` |
| Graceful shutdown | `cmd/skiix/main.go` pattern |
| Auth secret validation | `pkg/config/auth_config.go` |
| Env vars | Merge `.env.example` (REDIS_URL, SENTRY_DSN, etc.) |

### P1 — Epic 2 features

| Feature | Source stack |
|---------|--------------|
| Waitlist | `domain/waitlist.go` → repo → usecase → `waitlist_handler.go` + migration |
| Notifications | `notification_*` full stack |
| Search | `search_*` (reconcile with `explore_handler`) |
| Quiet hours | `pkg/quiethours/` + `user_quiet_hours` table + device routes |

### P2 — Quality

| Item | Source |
|------|--------|
| Integration test harness | `repository/integration_main_test.go` |
| 14 integration tests | `*_integration_test.go` in repository |
| CI with Postgres service | `.github/workflows/ci.yml` from source (merge with monorepo CI) |
| Swagger regen | After all ports |

### P3 — Reconcile ✅ **Closed (ADR-005, 2026-06-07)**

| Topic | Decision |
|-------|----------|
| Chat | **Supabase DM only** — keep `conversations_handler` + WebSocket; do not port standalone Postgres chat |
| Social | **Furqan model** — `followers` + `connections`; do not port `user_follows` / `user_blocks` |
| Feed path | **`GET /api/v1/feed`** — no `/feeds` alias |
| Bookmarks | **`saves` + bookmark actions** — do not port `post_bookmarks` / reposts |

See [ADR-005](../adr/005-monorepo-reconciliation-decisions.md).

---

## In monorepo only — NEVER overwrite

```
backend/internal/infrastructure/supabase_*.go
backend/internal/delivery/http/supabase_middleware.go
backend/internal/delivery/http/conversations_handler.go
backend/internal/delivery/http/messaging_ws_hub.go
backend/internal/delivery/http/reels_handler.go
backend/internal/delivery/http/explore_handler.go
backend/internal/delivery/http/upload_handler.go
backend/internal/delivery/http/ai_handler.go
backend/internal/delivery/http/otp_handler.go
backend/internal/delivery/http/public_posts_handler.go
backend/internal/infrastructure/cloudinary.go
```

---

## High-conflict files (coordinate before edit)

| File | Why |
|------|-----|
| `routes.go` | Both teams add `Register*` calls |
| `main.go` | DI + middleware differ |
| `pkg/migration/migration.go` | Append-only; never delete target tables |
| `social_handler.go` | **Same filename, different features** |
| `repository/social.go` | Stories vs Epic social graph |
| `post_handler.go` / `post.go` | Feed path + engagement models |
| `middleware.go` | JWT-only vs dual auth |

---

## Professional sync procedure (per feature)

```
1. Decision    → Document in ADR or docs/reports/ if diverged
2. Branch      → feature/SKX-xxx from develop
3. Port        → New files first; minimal edits to wiring files
4. Auth        → BearerAuthMiddleware on new routes (ADR-004)
5. Migration   → Append SQL at end of migration.go only
6. Test        → Unit + integration if applicable
7. App smoke   → Expo still loads feed + login
8. PR          → develop (not main); tag conflict-risk files in description
9. Track       → Update this doc sync matrix
```

---

## Recommended sync phases (updated)

| Phase | Scope | Branch | Est. |
|-------|-------|--------|------|
| **0** | Decision gate (chat, social, feed URL) | — | ✅ ADR-005 |
| **A** | Production foundation (Redis, middleware, health) | `feature/SKX-infra-prod` | 2–3 days |
| **B** | Waitlist + notifications + search + quiet hours | `feature/SKX-epic2-features` | 3–5 days |
| **C** | Integration tests + CI Postgres | `feature/SKX-integration-tests` | 2–3 days |
| **D** | Social/bookmark reconciliation | — | ✅ Skipped (ADR-005) |
| **E** | Archive `skiix-backend` | README pointer | After C green |

**Mood Feed (was Phase 1):** ✅ Complete on `main`.

---

## Archive `skiix-backend` — when safe

| Gate | Status |
|------|--------|
| Mood Feed on `skiix_app/main` | ✅ |
| Integration tests on monorepo CI | ✅ PR #4 on `develop` |
| `develop` → `main` release | 🔲 |
| Furqan confirms no direct pushes to old repo | 🔲 |
| README on `xinnxz/skiix-backend` points to `furqan137/skiix_app` | ✅ |

---

## Immediate next steps (post PR #2–#4)

1. **Release** `develop` → `main` — [17-post-sync-status.md](./17-post-sync-status.md)
2. **Smoke test** — `/health`, waitlist, Expo login + feed
3. **Archive** `xinnxz/skiix-backend` on GitHub
4. **Juan** — Mood Feed UI (doc 14)
5. **Optional** — `swag init` for new endpoints

---

## One-line strategy

> **`skiix-backend` is the blueprint; `skiix_app` is the product.**  
> Port infrastructure and missing Epic 2 modules **additively** onto the Supabase-first mobile backend.

---

*Analysis v1.0 — refresh after each sync phase merges to `develop`.*
