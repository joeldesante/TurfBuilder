# API Reference

TurfBuilder exposes a set of internal JSON APIs consumed by the web client.
All org-scoped routes are prefixed with `/o/{org_slug}/`.

## Auth levels

| Level | Description |
|-------|-------------|
| 🌐 Public | No authentication required |
| 🏠 Org Member | Authenticated user and org member |
| 👤 Staff | Org member with a staff role |
| 👑 Owner | Staff member with `is_owner = true` |

## Sections

- [Public API](./public.md) — Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.
- [Volunteer API](./volunteer.md) — Endpoints used by canvassers in the field. Require org membership but not staff access.
- [Surveys](./surveys.md) — Staff endpoints for creating and managing survey templates and questions.
- [Turfs](./turfs.md) — Staff endpoints for creating canvassing territories from GeoJSON polygons.
- [Members](./members.md) — Staff endpoints for managing organization membership and role assignments.
- [Roles & Permissions](./roles.md) — Owner-only endpoints for managing custom staff roles and their permission sets.
- [Invite Links](./invites.md) — Owner-only endpoints for token-based and slug-based org invite links.
- [Plugins](./plugins.md) — Staff endpoints for installing, configuring, and routing to plugin-defined API handlers.