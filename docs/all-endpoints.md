# All Endpoints

# Public API

Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/turf/{id}/locations`

Returns all locations assigned to a turf along with a geographic center point.
Verifies the turf belongs to the caller's organization before returning data.

**Auth:** Org member  

**Response**

{ locations: Location[], center: { lat: number, lng: number } }

---

# Volunteer API

Endpoints used by canvassers in the field. Require org membership but not staff access.

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/join`

Adds the authenticated user to a turf using a 6-character join code.
If the user is already in the turf the insert is silently ignored.

**Auth:** Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `code` | `string` | ✓ | 6-character alphanumeric turf join code |

**Response**

{ id: string } UUID of the turf that was joined

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/map/{id}/location/{location_id}`

Records a door-knock attempt for a specific address within a turf.
Creates or updates the attempt record, then saves survey responses when contact was made.
Caller must be an assigned turf member.

**Auth:** Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contactStatus` | `'no_contact'|'contacted'` | ✓ | Outcome of the canvassing visit |
| `attemptNote` | `string` |  | Optional free-text note about the visit |
| `questions` | `any` |  | {Array<{db_id: uuid, response: string}>} required - Survey question responses (only saved when contacted) |

**Response**

{ success: true }

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/map/{id}/status`

Returns visit status for all locations in a turf. Caller must be a turf member.
Used by the volunteer map page to show which addresses have been visited.

**Auth:** Org member  

**Response**

Array of { id, visited: boolean, contact_made: boolean | null }

---

# Surveys

Staff endpoints for creating and managing survey templates and questions.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/surveys`

Lists surveys for the organization.

**Auth:** Staff  
**Permission:** `survey:read`

**Response**

Array of { id: string, name: string, description: string | null }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys`

Creates a new survey template for the organization with no questions.
Questions are added separately via the /questions endpoint.

**Auth:** Staff  
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

**Auth:** Staff  
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

**Auth:** Staff  
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

**Auth:** Staff  
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

Creates one or more turfs from GeoJSON polygon geometries.

When called from the universe list-based cut flow, supply `list_id` and `bucket_id`.
Locations are then sourced from `universe.list_entry` for that list using ST_Contains.

When called without a list context, locations are sourced from `location_unified`
(the traditional two-tier location pool) using ST_Contains.

Each turf receives a unique 6-character join code. Defaults to a 7-day expiry.

**Auth:** Staff  
**Permission:** `turf:create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `polygons` | `any` |  | {Array<{geometry: GeoJSON}>} required - GeoJSON polygon geometries |
| `survey_id` | `string` | ✓ | UUID of the survey to attach to all created turfs |
| `expires_at` | `string` |  | ISO 8601 expiration date; defaults to 7 days from now |
| `list_id` | `string` |  | UUID of the universe list this cut derives from |
| `bucket_id` | `string` |  | UUID of the universe bucket this cut derives from |

**Response**

{ turfs: Turf[] } Array of created turf records

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/turfs/{id}/preview`

Returns the polygon bounds and all assigned locations for a turf, for map preview.

**Auth:** Staff  
**Permission:** `turf:read`

**Response**

{ bounds: string, locations: LocationPreview[] }

---

# Members

Staff endpoints for managing organization membership and role assignments.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/members`

Returns all members of the organization with their assigned role info.

**Auth:** Staff  
**Permission:** `member:read`

**Response**

{ members: Array<{ id, name, email, role_id, role_name }> }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}/permissions`

---

# Roles & Permissions

Owner-only endpoints for managing custom staff roles and their permission sets.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/roles`

Returns all roles for the organization, each with their permission set.

**Auth:** role.read  

**Response**

Array of { id, name, is_default, permissions: string[] }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/roles`

Creates a new role for the organization.

**Auth:** role.create  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Display name for the new role |
| `weight` | `number` |  | optional - Priority weight (lower = higher priority) |

**Response**

{ id, name, is_default }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Renames a role. The default (Everyone) role cannot be renamed.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | New display name for the role |

**Response**

{ id, name, is_default }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Permanently deletes a role. The default (Everyone) role cannot be deleted.

**Auth:** role.delete  

**Response**

204 No Content on success

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/roles/{id}/permissions`

Replaces the full permission set for a role.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `permissions` | `string[]` | ✓ | Full list of resource.action keys to grant |

**Response**

{ ok: true }

---

# Invite Links

Owner-only endpoints for token-based and slug-based org invite links.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Returns all token-based invite links for the org plus the slug invite toggle state.

**Auth:** member.invite  

**Response**

{ links: Array<{ id, created_at, expires_at }>, slugInviteEnabled: boolean }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Creates a new token-based invite link for the organization.
Accessible at `/invite/{token}` once created.

**Auth:** member.invite  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `expires_at` | `string | null` |  | ISO 8601 expiration date, or null for no expiry |

**Response**

{ id, created_at, expires_at }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/invite-links/{id}`

Permanently revokes an invite link. The link can no longer be used to join the org.

**Auth:** member.invite  

**Response**

{ ok: true }

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/invite-links/slug`

Enables or disables the org slug-based open invite.
When enabled, anyone with the link can join at `/invite/{org_slug}`.

**Auth:** member.invite  

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

**Auth:** Staff  
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

**Auth:** Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/uninstall`

Disables a plugin for the organization. The plugin is removed from the staff nav.
Config and any plugin-stored data are retained for potential re-installation.

**Auth:** Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---

# Other

Miscellaneous endpoints.

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/infra/email/api`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/infra/email/templates/{key}/api`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/infra/migrate/api`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/infra/settings/api`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/buckets`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/buckets/{slug}/lists`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/locations`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/locations/import`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/query`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/scripts`

Lists scripts for the organization, optionally filtered by bucket slug.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bucket` | `string` | optional - bucket slug to filter by |

**Response**

Array of { id: string, name: string }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/scripts`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/scripts/{id}`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/search`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/lists/{id}/locations`

Returns all location entries from a universe list with their coordinates.
Only works for lists with entity_type = 'locations'.

**Auth:** Staff  
**Permission:** `turf:create`

**Response**

Array of location entries with lat/lng for map display

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/lists/{id}/turfs`

Returns all turfs for a universe list, including polygon geometry (GeoJSON),
for the list overview map.

**Auth:** Staff  
**Permission:** `turf:read`

**Response**

Array of turfs with GeoJSON bounds and metadata

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/import`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/import/overture`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/people/import`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/stats`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/universe/data/integrations/api`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/orgs/create`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/setup/api/check-db`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/setup/api/create-admin`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/setup/api/create-schema`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/setup/api/save-email-settings`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/setup/api/save-settings`

---
