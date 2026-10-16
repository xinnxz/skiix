# PR: Phase B — Epic 2 features

**Base:** `develop` (merge Phase A PR first, then rebase if needed)  
**Head:** `feature/SKX-epic2-features`  
**Create:** https://github.com/furqan137/skiix_app/compare/develop...feature/SKX-epic2-features

## Title

`feat(backend): Epic 2 waitlist, notifications, search, quiet hours`

## Summary

- Waitlist API with hourly rate limit + optional Resend audience sync
- In-app notifications CRUD-style read APIs
- Search and trending hashtag/post endpoints (Bearer auth)
- Push quiet hours on device routes; suppress FCM during quiet window

## Depends on

Phase A PR (`feature/SKX-infra-prod`) — includes Redis + middleware from that branch.

## Test plan

- [x] `go test ./...`
- [x] `go build ./cmd/skiix/`
- [ ] `POST /api/v1/waitlist` with consent
- [ ] `GET /api/v1/notifications` with Supabase bearer
- [ ] `PUT /api/v1/devices/quiet-hours`

## Breaking changes

None — new routes and migrations only (append-only).
