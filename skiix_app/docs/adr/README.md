# Architecture Decision Records (ADR)

> **Purpose:** Binding technical decisions for the Skiix monorepo.  
> **Owners:** Luthfi Alfaridz (Backend), Furqan Zafar (DevOps)

---

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-chat-firebase-vs-postgres.md) | Chat: Firebase RTDB + Postgres hybrid | **Accepted** | 2026-06-05 |
| [002](./002-supabase-postgres-hosting.md) | Supabase Postgres hosting (legacy backend) | **Superseded** | 2026-06-05 |
| [003](./003-repo-migration-handoff.md) | Repository migration & handoff | **Accepted** | 2026-06-05 |
| [004](./004-supabase-auth-monorepo.md) | Supabase Auth for mobile (monorepo) | **Accepted** | 2026-06-05 |

---

## Monorepo note

ADR-002 applied to the standalone `xinnxz/skiix-backend` repo (custom JWT only).  
This monorepo uses **Supabase Auth on mobile** — see [ADR-004](./004-supabase-auth-monorepo.md).

---

## How to propose a new ADR

1. Copy an existing ADR as template
2. Set status to **Proposed**
3. PR review with backend + mobile leads
4. On merge, set status to **Accepted**
