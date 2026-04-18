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

- [Public API](api/public.md) — Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.
- [Volunteer API](api/volunteer.md) — Endpoints used by canvassers in the field. Require org membership but not staff access.
- [Surveys](api/surveys.md) — Staff endpoints for creating and managing survey templates and questions.
- [Turfs](api/turfs.md) — Staff endpoints for creating canvassing territories from GeoJSON polygons.
- [Members](api/members.md) — Staff endpoints for managing organization membership and role assignments.
- [Roles & Permissions](api/roles.md) — Owner-only endpoints for managing custom staff roles and their permission sets.
- [Invite Links](api/invites.md) — Owner-only endpoints for token-based and slug-based org invite links.
- [Plugins](api/plugins.md) — Staff endpoints for installing, configuring, and routing to plugin-defined API handlers.

---

# Public API

Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/locations`

Returns all locations within a lat/lon bounding box. Used by the volunteer
map to populate visible addresses. Results are capped at 500 rows.

**Auth:** 🌐 Public — no authentication required  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `lat_min` | `number` | Southern boundary latitude (-90 to 90) |
| `lat_max` | `number` | Northern boundary latitude (-90 to 90) |
| `lon_min` | `number` | Western boundary longitude (-180 to 180) |
| `lon_max` | `number` | Eastern boundary longitude (-180 to 180) |

**Response**

Array of location objects: id, location_name, category, latitude, longitude, street, locality, postcode, region, country

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/turf/{id}/locations`

Returns all locations assigned to a turf along with a geographic center point.
Verifies the turf belongs to the caller's organization before returning data.

**Auth:** 🏠 Org member  

**Response**

{ locations: Location[], center: { lat: number, lng: number } }

---

# Volunteer API

Endpoints used by canvassers in the field. Require org membership but not staff access.

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/join`

Adds the authenticated user to a turf using a 6-character join code.
If the user is already in the turf the insert is silently ignored.

**Auth:** 🏠 Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `code` | `string` | ✓ | 6-character alphanumeric turf join code |

**Response**

{ id: string } UUID of the turf that was joined

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/map/{id}/location/{location_id}`

Records a door-knock attempt for a specific address within a turf.
Upserts contact status, a free-text note, and all survey question responses in a single transaction.
Caller must be an assigned turf member.

**Auth:** 🏠 Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contactMade` | `boolean` | ✓ | Whether the canvasser made contact at this address |
| `attemptNote` | `string` |  | Optional free-text note about the visit |
| `questions` | `any` |  | {Array<{db_id: uuid, response: string}>} required - Survey question responses |

**Response**

{ success: true }

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/map/{id}/status`

Returns visit status for all locations in a turf. Caller must be a turf member.
Used by the volunteer map page to show which addresses have been visited.

**Auth:** 🏠 Org member  

**Response**

Array of { id, visited: boolean, contact_made: boolean | null }

---

# Surveys

Staff endpoints for creating and managing survey templates and questions.

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys`

Creates a new survey template for the organization with no questions.
Questions are added separately via the /questions endpoint.

**Auth:** 👤 Staff  
**Permission:** `survey:create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Survey name, 1–255 characters |

**Response**

{ id: string } UUID of the created survey

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}`

Updates the name and optional description of an existing survey.

**Auth:** 👤 Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Survey name, 1–255 characters |
| `description` | `string` |  | Survey description, max 2000 characters |

**Response**

{ success: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}/questions`

Upserts questions for a survey. Questions with a `db_id` are updated;
those without are created. Typically called after `questions/purge` to
fully replace the question set.

**Auth:** 👤 Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `questions` | `Array` | ✓ | Array of question objects: db_id? (uuid), type (string), text (string), choices (string[]), index (number) |

**Response**

{ success: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}/questions/purge`

Deletes all questions for a survey except those listed in `exclude`.
Called before re-saving the full question set to remove questions the
editor dropped. Pass all retained question IDs in `exclude`.

**Auth:** 👤 Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `exclude` | `string[]` |  | UUIDs of questions to keep; all others are deleted |

**Response**

{ success: true }

---

# Turfs

Staff endpoints for creating canvassing territories from GeoJSON polygons.

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/turf/create`

Creates one or more turfs from GeoJSON polygon geometries. For each polygon,
PostGIS ST_Contains automatically assigns all locations within its bounds.
Each turf receives a unique 6-character join code. Defaults to a 7-day expiry.

**Auth:** 👤 Staff  
**Permission:** `turf:create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `polygons` | `any` |  | {Array<{geometry: GeoJSON}>} required - GeoJSON polygon geometries defining each turf boundary |
| `survey_id` | `string` | ✓ | UUID of the survey to attach to all created turfs |
| `expires_at` | `string` |  | ISO 8601 expiration date; defaults to 7 days from now |

**Response**

{ turfs: Turf[] } Array of created turf records

---

# Members

Staff endpoints for managing organization membership and role assignments.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/members`

Returns all members of the organization with their assigned role info.

**Auth:** 👤 Staff  
**Permission:** `member:read`

**Response**

{ members: Array<{ id, name, email, role_id, role_name }> }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

Assigns or removes a role for an org member.
Blocked if the target is the last administrator and the new role is not also an owner role.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role_id` | `string | null` | ✓ | Role UUID to assign, or null to remove the role |

**Response**

{ ok: true }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

Removes a member from the organization entirely.
Blocked if the target is the last administrator (uses FOR UPDATE lock to prevent race conditions).

**Auth:** 👤 Staff  
**Permission:** `member:delete`

**Response**

{ ok: true }

---

# Roles & Permissions

Owner-only endpoints for managing custom staff roles and their permission sets.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/roles`

Returns all custom roles for the organization, each with their permission set.

**Auth:** 👤 Staff  
**Permission:** `member:read`

**Response**

Array of { id, name, is_owner, is_default, permissions: string[] }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/roles`

Creates a new custom staff role for the organization.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Display name for the new role |

**Response**

{ id, name, is_owner, is_default }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Renames a custom role. System roles (is_owner = true) cannot be renamed.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | New display name for the role |

**Response**

{ id, name, is_owner, is_default }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Permanently deletes a custom role. System roles and the default role cannot be deleted.

**Auth:** 👑 Owner only  

**Response**

204 No Content on success

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/roles/{id}/permissions`

Replaces the full permission set for a role. Any permissions not in the submitted
list are removed. Each entry must be a valid `resource:action` key.
Valid resources: canvass, turf, survey, response, member, plugin.
Valid actions: use, create, read, update, delete.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `permissions` | `string[]` | ✓ | Full list of resource:action strings to assign |

**Response**

{ ok: true }

---

# Invite Links

Owner-only endpoints for token-based and slug-based org invite links.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Returns all token-based invite links for the org plus the slug invite toggle state.

**Auth:** 👑 Owner only  

**Response**

{ links: Array<{ id, created_at, expires_at }>, slugInviteEnabled: boolean }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Creates a new token-based invite link for the organization.
Accessible at `/invite/{token}` once created.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `expires_at` | `string | null` |  | ISO 8601 expiration date, or null for no expiry |

**Response**

{ id, created_at, expires_at }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/invite-links/{id}`

Permanently revokes an invite link. The link can no longer be used to join the org.

**Auth:** 👑 Owner only  

**Response**

{ ok: true }

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/invite-links/slug`

Enables or disables the org slug-based open invite.
When enabled, anyone with the link can join at `/invite/{org_slug}`.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enabled` | `boolean` | ✓ | Whether the slug-based open invite is active |

**Response**

{ ok: true, enabled: boolean }

---

# Plugins

Staff endpoints for installing, configuring, and routing to plugin-defined API handlers.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/config`

Updates the stored configuration for an installed plugin.
If the plugin defines a `configSchema` (Zod), the body is validated before saving.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `(plugin-defined) - JSON config object validated against the plugin's configSchema if present` | `any` |  |  |

**Response**

{ ok: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/install`

Installs and enables a plugin for the organization. Creates or re-enables
the plugin_installation record. The plugin appears in the staff nav immediately.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/uninstall`

Disables a plugin for the organization. The plugin is removed from the staff nav.
Config and any plugin-stored data are retained for potential re-installation.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---
