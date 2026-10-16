# ADR-005: Monorepo Reconciliation — Chat, Social, Feed, Bookmarks

> **Status:** Accepted  
> **Date:** June 7, 2026  
> **Deciders:** Luthfi Alfaridz (Backend), Ashhad Khan (Product), per Furqan Zafar (repo owner)  
> **Context:** Phase 0 decision gate in [16-backend-sync-deep-analysis.md](../reports/16-backend-sync-deep-analysis.md)

---

## Context

`xinnxz/skiix-backend` (Epic 2) and `furqan137/skiix_app/backend` diverged on chat transport, social graph schema, feed URL, and bookmark model. Porting Epic 2 features requires a single canonical choice per area so mobile, backend, and merge work stay aligned.

**Repo owner preference (Furqan):** keep `skiix_app` contracts — mobile already ships against them.

---

## Decisions

### 1. Chat — Supabase DM only ✅

**Decision:** Keep Furqan's **Supabase Postgres DM** stack. Do **not** port standalone Postgres chat CRUD or replace DM with Firebase RTDB as primary transport.

| Keep (monorepo) | Do not port (standalone) |
|-----------------|--------------------------|
| `conversations_handler.go` — `/api/v1/conversations/*` | `chat_handler.go` Postgres message CRUD from Epic 2 |
| `messaging_ws_hub.go` — `/api/v1/ws/messaging` | RTDB-first send path from ADR-001 beta flow |
| Supabase-backed `conversations` + `conversation_participants` | Duplicate `conversations` / `messages` schema from standalone |

**Firebase scope (unchanged):** FCM push + optional `GET /api/v1/chat/auth-token` for legacy clients — **not** primary DM transport.

**Supersedes for monorepo:** ADR-001 hybrid Postgres+RTDB **send path** — mobile uses Supabase DM + WebSocket, not dual-write to RTDB.

---

### 2. Social graph — Furqan model (`followers` + `connections`) ✅

**Decision:** Canonical social layer is the **monorepo schema and APIs**.

| Canonical | Tables / routes |
|-----------|-----------------|
| Follow (one-way) | `followers` — `POST /api/v1/follow`, user stats |
| Connection (mutual request/accept) | `connections` — `/api/v1/connections/*` |
| Stories audience | `social_handler.go` — stories, connections visibility |

**Do not port from standalone:**

- `user_follows` / `user_blocks` tables
- Epic 2 `SocialUsecase` follow/block APIs
- Standalone `social_handler.go` engagement graph

**When porting Epic 2 features** (notifications, search privacy, quiet hours): rewrite queries against `followers` and `connections`, not `user_follows` / `user_blocks`.

---

### 3. Feed URL — `GET /api/v1/feed` (singular) ✅

**Decision:** Single canonical feed endpoint per Furqan's mobile client.

| Canonical | Notes |
|-----------|-------|
| `GET /api/v1/feed` | Home feed; supports `?mood=` after Mood Feed merge |
| `GET /api/v1/feed/shuffle`, `/spark`, etc. | Feed feature sub-routes — unchanged |

**Do not add** `GET /api/v1/feeds` unless a future client explicitly requires it. Standalone `/feeds` is **reference only** — not a merge target.

---

### 4. Bookmarks — `saves` + bookmark actions (implicit, Furqan model) ✅

**Decision:** Keep monorepo bookmark model.

| Canonical | Routes |
|-----------|--------|
| `saves` table | Reels toggle save, feed `saves_count` |
| Bookmark workspace | `POST /api/v1/bookmarks/workspace`, reminders, notes |

**Do not port** standalone `post_bookmarks`, repost APIs, or `post_engagement` bookmark/repost handlers.

---

## Consequences

### Positive

- Zero mobile breaking changes on social, feed, chat, bookmarks
- Phase D reconciliation **closed** — no schema migration between graph models
- Epic 2 ports have clear rewrite rules (adapt SQL, don't copy tables)

### Negative / trade-offs

- Standalone Epic 2 integration tests for `user_follows` / `/feeds` must be **rewritten**, not cherry-picked
- Block list from standalone is **not** in monorepo v1 — add later if product requires (new ADR)
- ADR-001 RTDB dual-write docs are historical for standalone; monorepo chat doc is this ADR + existing handlers

### Port checklist (when merging from `skiix-backend`)

| Feature | Action |
|---------|--------|
| Waitlist | Port as-is (no social dependency) |
| Notifications | Port logic; target `followers` for "new follower" events |
| Search | Port; privacy filters use `followers` / `connections`, not `user_blocks` |
| Quiet hours | Port as-is |
| Redis / middleware / health | Port as-is |
| Integration tests | Rewrite graph/feed assertions for monorepo schema |

---

## Sign-off

| Role | Name | Decision |
|------|------|----------|
| Backend Lead | Luthfi Alfaridz | Accepted 2026-06-07 |
| Repo Owner | Furqan Zafar | Align with `skiix_app` (per team) |
| Product | Ashhad Khan | Gate closed |

---

## References

- [ADR-001](./001-chat-firebase-vs-postgres.md) — standalone hybrid (historical)
- [ADR-004](./004-supabase-auth-monorepo.md) — auth on all ported routes
- [16-backend-sync-deep-analysis.md](../reports/16-backend-sync-deep-analysis.md)
