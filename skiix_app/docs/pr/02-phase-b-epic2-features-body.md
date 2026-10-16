## Summary

- Waitlist API (`POST /api/v1/waitlist`) with hourly rate limit + optional Resend audience sync
- In-app notifications APIs under `/api/v1/notifications/*` (Bearer auth)
- Search + trending under `/api/v1/search/*`
- Push quiet hours on `/api/v1/devices/quiet-hours`; FCM suppressed during quiet window

## Depends on

Phase A (`feature/SKX-infra-prod`) — Redis + production middleware.

## Test plan

- [x] `go test ./...`
- [x] `go build ./cmd/skiix/`
- [ ] `POST /api/v1/waitlist` with `consent_given: true`
- [ ] `GET /api/v1/notifications` with Supabase bearer
- [ ] `PUT /api/v1/devices/quiet-hours`

## Breaking changes

None — new routes and append-only migrations only.
