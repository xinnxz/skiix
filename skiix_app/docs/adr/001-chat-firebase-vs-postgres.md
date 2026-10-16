# ADR-001: Chat Architecture — Firebase RTDB + PostgreSQL Hybrid

> **Status:** Accepted  
> **Date:** June 5, 2026  
> **Deciders:** Furqan Zafar (DevOps/Infra), Luthfi Alfaridz (Backend)  
> **Triggered by:** WhatsApp sync — Firebase for real-time chat + push; avoid Supabase Realtime debugging pain

---

## Context

Skiix needs 1:1 direct messaging with near-real-time delivery on mobile. The backend currently implements **two parallel chat paths**:

| Path | Implementation | Purpose |
|------|----------------|---------|
| **REST + PostgreSQL** | `conversations`, `messages` tables; full CRUD via Go API | Durable storage, list/history, authorization |
| **Firebase RTDB** | `GET /api/v1/chat/auth-token` → custom token | Real-time delivery on mobile client |

Without a written decision, FE/mobile could:
- Write messages only to Postgres (polling, slow)
- Write messages only to Firebase (Go API chat endpoints unused)
- Write to **both** (duplicate messages, inconsistent unread counts)

Furqan has more operational experience with Firebase for push and real-time. The team agreed to keep Firebase for those concerns.

---

## Decision

**Adopt a hybrid chat model with clear ownership per layer:**

```
Mobile App
    │
    ├─ Real-time listen/send ──► Firebase Realtime Database
    │                              (live message stream)
    │
    └─ Bootstrap & metadata ───► Go API (PostgreSQL)
                                   (conversations, auth, push triggers)

Go API
    ├─ Authorize all chat actions (JWT)
    ├─ Issue Firebase custom tokens (chat/auth-token)
    ├─ Persist conversation metadata + message backup in Postgres
    └─ Trigger FCM push on new messages (when recipient offline)
```

### Responsibility matrix

| Concern | Owner | Notes |
|---------|-------|-------|
| Who can message whom | **Go API** | Block list, user existence |
| Conversation creation | **Go API** | `POST /conversations/direct` |
| Conversation list | **Go API** | `GET /conversations` |
| Live message delivery | **Firebase RTDB** | Client subscribe/write |
| Message history (paginated) | **Go API** | `GET /conversations/:id/messages` — Postgres |
| Message send (durable) | **Go API** | `POST /conversations/:id/messages` — Postgres canonical |
| RTDB sync (optional v2) | **Cloud Function or Go worker** | Post-beta; not required for beta |
| Push notification | **Firebase FCM** | Via Go API `FirebaseService` |
| Unread count | **Go API** (source of truth) | `PATCH .../read` |

### Beta flow (MVP)

1. User opens DM → `GET /conversations` (Postgres)
2. User opens chat → `GET /chat/auth-token` → sign in to RTDB
3. **Send message:** `POST /conversations/:id/messages` (Postgres) **AND** client writes to RTDB for live UI
4. Recipient online → RTDB listener shows message instantly
5. Recipient offline → FCM push via Go API
6. Mark read → `PATCH /conversations/:id/read` (Postgres)

> **Beta rule:** Postgres is always written on send. RTDB is for real-time UX only. If RTDB write fails, message still exists in Postgres.

### Explicitly rejected for chat

| Option | Reason |
|--------|--------|
| Supabase Realtime | Overlaps Firebase; Furqan reports debugging difficulty |
| Postgres-only polling | Poor UX for real-time chat |
| RTDB-only (no Postgres) | No server-side audit, search, or moderation path |
| Third auth system (Firebase Auth) | JWT already handles identity; duplicate auth adds complexity |

---

## Consequences

### Positive

- Leverages Furqan's Firebase experience
- Real-time UX without building WebSocket infra in Go
- Postgres retains durable history and business-rule enforcement
- Aligns with existing `FirebaseService` and chat tables

### Negative / Trade-offs

- Dual-write on send (Postgres + RTDB) — FE must implement both
- Possible short-term inconsistency if RTDB write fails
- Firebase vendor lock-in for real-time layer
- Postgres chat endpoints must stay maintained until RTDB sync worker exists

### Follow-up (post-beta)

- [ ] Cloud Function: on RTDB write → upsert Postgres (single-write from client)
- [ ] Or: remove RTDB client write; Go API publishes to RTDB after Postgres insert
- [ ] Cursor pagination on `GET /conversations/:id/messages`

---

## References

- `internal/delivery/http/chat_handler.go` — REST endpoints
- `internal/infrastructure/firebase_service.go` — FCM + custom token
- `internal/repository/chat_repository.go` — Postgres persistence
- ADR-005 in `08-architecture.md` — Push via Firebase FCM

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Backend Lead | Luthfi Alfaridz | 2026-06-05 |
| DevOps / Infra | Furqan Zafar | _pending formal ack_ |
| Mobile Lead | _TBD_ | _pending_ |
