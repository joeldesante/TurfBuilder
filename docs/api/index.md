# API Reference

TurfBuilder exposes a set of internal JSON APIs consumed by the web client.
All org-scoped routes are prefixed with `/o/{org_slug}/`.

## Auth levels

| Level | Description |
|-------|-------------|
| Public | No authentication required |
| Org Member | Authenticated user and org member |
| Staff | Org member with a staff role |
| Owner | Staff member with `is_owner = true` |

## Sections

- [Public API](./public.md) — Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.
- [List Documents](./documents.md) — Staff endpoints for generating, polling, downloading, and deleting the printable PDF of a location list.
- [Other](./other.md) — Miscellaneous endpoints.