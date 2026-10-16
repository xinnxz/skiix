# Mood Feed — Mobile UI Brief

> **Audience:** Juan / mobile team  
> **Backend:** `feature/SKX-712-mood-feed`  
> **Tiers:** [13-mood-tier-ceo-decision.md](./13-mood-tier-ceo-decision.md)

---

## Free vs Pro (render from API, do not hardcode)

| Tier | Moods | UI |
|------|-------|-----|
| Free | Sad, Chill, Hype | Always selectable |
| Pro | 9 others | Lock icon + upgrade CTA |

---

## Key endpoints

```
GET  /api/v1/moods              → use `available` + `tier` per mood
GET  /api/v1/feed?mood=chill     → mood-filtered feed
POST /api/v1/posts              → optional moods[] (1–2)
```

Auth: Supabase bearer (already in `axiosInstance.ts`).

---

## Test checklist

- [ ] Free user: 3 moods unlocked, 9 locked in picker
- [ ] Feed filter with free mood works
- [ ] Pro mood shows paywall / error
- [ ] Post with free moods succeeds
