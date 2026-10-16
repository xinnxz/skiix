# Mood Feed — API Alignment

> **Date:** June 7, 2026  
> **Status:** Implemented on `feature/SKX-712-mood-feed`  
> **Tier model:** [13-mood-tier-ceo-decision.md](./13-mood-tier-ceo-decision.md) (3 free / 9 Pro — CEO confirmed)

---

## Feature → Backend Mapping

| Requirement | Backend | Endpoint |
|-------------|---------|----------|
| Mood catalog | ✅ | `GET /api/v1/moods` |
| Chronological filter | ✅ | `GET /api/v1/feed?mood=` |
| Free tier moods (3) | ✅ | sad, chill, hype |
| Pro tier moods (9) | ✅ | creative, motivated, curious + 6 expanded |
| Mood scheduling (Pro) | ✅ | `/api/v1/moods/schedules` |
| Mood history (Pro) | ✅ | `/api/v1/moods/sessions` |
| Tag 1–2 moods at publish | ✅ | `POST /api/v1/posts` — `moods` optional (backward compat) |
| Creator-only mood view | ✅ | `GET /api/v1/posts/:id/moods` |
| Edit moods within 24h | ✅ | `PATCH /api/v1/posts/:id/moods` |

> **Note:** Original PRD slides listed 6 free moods. CEO (Ashhad) approved **3 free / 9 Pro** — see report 13.

---

## Mood Catalog (current)

### Free (3)

| ID | Label | Alias |
|----|-------|-------|
| `sad` | Sad | — |
| `chill` | Chill | `happy` |
| `hype` | Hype | `excited` |

### Pro / Plus (9)

| ID | Label |
|----|-------|
| `creative` | Creative |
| `motivated` | Motivated |
| `curious` | Curious |
| `nostalgic` | Nostalgic |
| `grateful` | Grateful |
| `focused` | Focused |
| `peaceful` | Peaceful |
| `restless` | Restless |
| `inspired` | Inspired |

---

## API Quick Reference

```
GET    /api/v1/moods                         → catalog + tier + available
GET    /api/v1/feed?mood=chill               → filtered feed
POST   /api/v1/posts  { moods: [...] }       → tag at publish (optional)
GET    /api/v1/posts/:id/moods               → creator only
PATCH  /api/v1/posts/:id/moods               → edit within 24h

# Pro only
POST   /api/v1/moods/sessions
GET    /api/v1/moods/sessions
GET/POST/PUT/DELETE /api/v1/moods/schedules
```

---

## Mobile brief

See [14-mood-ui-brief-mobile.md](./14-mood-ui-brief-mobile.md).
