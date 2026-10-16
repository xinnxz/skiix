# Backend Merge Plan — Epic 2 → Monorepo

> **Date:** June 5, 2026  
> **Source:** `xinnxz/skiix-backend` @ `feature/epic-2-completion`  
> **Target:** `furqan137/skiix_app/backend`  
> **Owner:** Luthfi Alfaridz

---

## Strategy

**Integrate, don't overwrite.** Furqan's backend has Supabase Auth, reels, WebSocket chat, and Cloudinary that the standalone repo lacks. The merge ports **missing epic-2 features** and **quality improvements** without breaking existing mobile flows.

```
xinnxz/skiix-backend (reference)
        │
        │  cherry-pick / manual port
        ▼
furqan137/skiix_app/backend
        │
        │  BearerAuthMiddleware on all new routes
        ▼
   feature/backend-epic2-merge → develop → main
```

---

## Phase 0 — Foundation ✅

| Task | Status |
|------|--------|
| Clone monorepo | ✅ |
| Root README, CONTRIBUTING, Makefile | ✅ |
| ADRs + reports | ✅ |
| CI workflow (backend + frontend lint) | ✅ |
| `backend/.golangci.yml` | ✅ |

**Branch:** `feature/monorepo-foundation`

---

## Phase 1 — Mood Feed (P0) ✅

**Branch:** `feature/SKX-712-mood-feed` → merged to `main`

| Task | Status |
|------|--------|
| Port mood domain + usecase + repo + handler | ✅ |
| Feed `?mood=` filter | ✅ (+ SQL fix f67a65e) |
| CEO 3 free / 9 Pro tiers | ✅ (a443d43) |
| Supabase auth on mood/chat/device routes | ✅ |

See [16-backend-sync-deep-analysis.md](./16-backend-sync-deep-analysis.md) for full gap vs `skiix-backend`.

---

## Phase A — Production foundation (P0) ✅

Merged on `feature/SKX-infra-prod` → PR to `develop`.

| Task | Source |
|------|--------|
| Redis client + rate limiting | `infrastructure/redis.go`, `rate_limiter.go` |
| CORS + security + request ID middleware | `*_middleware.go` |
| Health check + graceful shutdown | `health_handler.go`, `cmd/skiix/main.go` |
| Structured logging + config validation | `pkg/logger/`, `pkg/config/` |

**Branch:** `feature/SKX-infra-prod`

---

## Phase B — Epic 2 features (P1) ✅

Merged via PR #3 → `develop`.

| Task | Source |
|------|--------|
| Waitlist stack | `waitlist_*` |
| Notifications | `notification_*` |
| Search + trending | `search_*` (reconcile with explore) |
| Quiet hours | `pkg/quiethours/` |

**Branch:** `feature/SKX-epic2-features`

---

## Phase C — Integration tests (P1) ✅

Merged via PR #4 → `develop`.

| Task | Source |
|------|--------|
| Port integration test harness | `integration_main_test.go` |
| 14 repository integration tests | `*_integration_test.go` |
| CI Postgres service job | merge into `.github/workflows/ci.yml` |

**Branch:** `feature/SKX-integration-tests`

---

## Phase 3 — Chat alignment ✅

Closed per [ADR-005](../adr/005-monorepo-reconciliation-decisions.md): **Supabase DM + WebSocket** only; no standalone Postgres chat port.

---

## Phase D — Reconcile divergences ✅

**Closed 2026-06-07** — [ADR-005](../adr/005-monorepo-reconciliation-decisions.md)

| Topic | Decision |
|-------|----------|
| Chat | Supabase DM only (no standalone Postgres chat port) |
| Social | Keep `followers` + `connections` (Furqan model) |
| Feed URL | `GET /api/v1/feed` only |
| Bookmarks | Keep `saves` + bookmark actions |

---

## Phase E — Docs & archive (P2) 🔲

| Task | Action |
|------|--------|
| Deep sync analysis | ✅ [16-backend-sync-deep-analysis.md](./16-backend-sync-deep-analysis.md) |
| Post-sync status | ✅ [17-post-sync-status.md](./17-post-sync-status.md) |
| Release `develop` → `main` | 🔲 [PR body](../pr/04-release-develop-to-main-body.md) |
| Update Swagger | `swag init` (follow-up PR) |
| Archive `xinnxz/skiix-backend` | README pointer ✅; GitHub archive 🔲 |
| `develop` branch protection | Furqan: enable on GitHub |

---

## Explicitly out of scope (keep Furqan's version)

- Supabase Auth middleware stack
- Reels / stories handlers
- Cloudinary upload flow
- WaveSpeed AI handler
- OTP / Resend signup flow
- WebSocket messaging hub

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Auth middleware mismatch | ADR-004; code review checklist |
| Migration conflict | Run migrations idempotently; test on Supabase staging |
| Duplicate feed endpoints | Monorepo uses `/api/v1/feed`; mood filter adds `?mood=` — align with FE |
| Module path `github.com/skiix-backend` | Defer rename; document in backend README |

---

## PR template

```markdown
## Summary
- Port Mood Feed (PRD-12) from feature/epic-2-completion

## Test plan
- [ ] go test ./...
- [ ] Manual: GET /api/v1/moods
- [ ] Manual: POST /api/v1/posts with moods
- [ ] Expo: feed filter (after FE PR)

## Breaking changes
- POST /api/v1/posts now requires `moods` (1–2 tags)
```

---

*Plan version 1.2 — Phases A/B/C merged to `develop`; release to `main` next.*
