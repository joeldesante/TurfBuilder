# All Endpoints

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

&#123; id: string &#125; UUID of the turf that was joined

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
| `questions` | `any` |  | &#123;Array&lt;&#123;db_id: uuid, response: string&#125;>&#125; required - Survey question responses (only saved when contacted) |

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/map/{id}/locations`

Records a business a volunteer found in the field that was not in the turf.

Colocated under map/[id]/ rather than /s/api/ because the staff layout
requires an organization role, which volunteers do not have.

The location is created tentative and attached to the turf immediately, so
the volunteer can knock it and submit a response right away even though it
never matched the bucket criteria the turf was cut from. It stays invisible
to search, buckets, lists, and future turf cuts until an organizer approves
it, which universe.v_locations enforces.

**Auth:** org, plus turf membership and an unexpired turf  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Location` | `any` |  | fields; latitude and longitude must fall inside the turf |

**Response**

&#123; turf_location_id, entity_id &#125;

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/map/{id}/locations/{entity_id}`

Corrects a location the volunteer added during this canvassing session.

Editable only while they authored it, it is still tentative, and the turf is
still open — see findEditableSuggestion. Once an organizer approves it or
the turf expires, the volunteer loses the handle.

The correction is a new version, so the original text the volunteer typed is
still recoverable.

**Auth:** org, plus authorship of a tentative suggestion on an unexpired turf  

**Response**

&#123; entity_id, id &#125;

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/map/{id}/locations/{entity_id}`

Withdraws a location the volunteer added by mistake.

A hard delete, unlike the admin soft delete: an unreviewed suggestion has no
history worth keeping, and leaving it would put a phantom door on the turf.
The cascade takes the location, its turf assignment, and any attempt or
survey responses recorded against it.

**Auth:** org, plus authorship of a tentative suggestion on an unexpired turf  

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/map/{id}/locations/{location_id}/edits`

Proposes a correction to a door whose record is wrong.

The proposal is parked for review rather than applied: the location is
already part of the official dataset, so a canvasser cannot change it
directly. Photos travel with the proposal as the evidence an organizer
checks before accepting it.

Note the path parameter is the turf_location id, matching the rest of the
canvassing routes, rather than a location entity id.

**Auth:** org, plus turf membership and an unexpired turf  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Any` | `any` |  | subset of the location fields, plus an optional note |

**Response**

&#123; id &#125;

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/map/{id}/status`

Returns visit status for all locations in a turf. Caller must be a turf member.
Used by the volunteer map page to show which addresses have been visited.

**Auth:** Org member  

**Response**

Array of &#123; id, visited: boolean, contact_made: boolean | null &#125;

---

# Surveys

Staff endpoints for creating and managing survey templates and questions.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/surveys`

Lists surveys for the organization, optionally filtered by bucket.

**Auth:** Staff  
**Permission:** `survey:read`

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bucketId` | `string` | optional - bucket UUID to filter by |
| `bucketSlug` | `string` | optional - bucket slug to filter by (alternative to bucketId) |

**Response**

Array of &#123; id: string, name: string, description: string | null &#125;

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

&#123; id: string &#125; UUID of the created survey

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

&#123; success: true &#125;

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

&#123; success: true &#125;

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

&#123; success: true &#125;

---

# Turfs

Staff endpoints for creating canvassing territories from GeoJSON polygons.

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/turf/create`

Creates one or more turfs from GeoJSON polygon geometries.

Turfs are always cut from a universe list: locations are sourced from
`universe.list_entry` for that list using ST_Contains, and the created
turfs belong to the list. Each turf receives a unique 6-character join
code. Defaults to a 7-day expiry.

**Auth:** Staff  
**Permission:** `turf:create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `polygons` | `any` |  | &#123;Array&lt;&#123;geometry: GeoJSON&#125;>&#125; required - GeoJSON polygon geometries |
| `survey_id` | `string` | ✓ | UUID of the survey to attach to all created turfs |
| `script_id` | `string` |  | UUID of the script to attach to all created turfs |
| `expires_at` | `string` |  | ISO 8601 expiration date; defaults to 7 days from now |
| `list_id` | `string` | ✓ | UUID of the universe list this cut derives from |

**Response**

&#123; turfs: Turf[] &#125; Array of created turf records

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/turfs/{id}/preview`

Returns the polygon bounds and all assigned locations for a turf, for map preview.

**Auth:** Staff  
**Permission:** `turf:read`

**Response**

&#123; bounds: string, locations: LocationPreview[] &#125;

---

# List Documents

Staff endpoints for generating, polling, downloading, and deleting the printable PDF of a location list.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents`

The list's current documents (generated PDFs), newest first. Replaced and
deleted documents are not included, so this is normally at most one, plus a
failed attempt when a regeneration failed and the previous PDF was restored.
No download links here; fetch a document by id for that.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`Array<{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at }>`, at most 20

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents`

Starts generating a printable PDF of the list: a master list of every
location, the turf checkout list, and one page per cut turf, with numbered
maps. The new document replaces the list's earlier ones (they are
soft-deleted) and they are restored if generation fails. Responds 202 as
soon as the row exists; poll the `Location` URL until the status is `ready`
or `failed`. Generation fails after 90 seconds. Only location lists can be
generated; a people list fails with a message saying so.

**Auth:** Staff  
**Permission:** `system.access`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `timeZone` | `string` |  | IANA timezone to print times in, e.g. `America/New_York`. Defaults to the server's zone. Temporary until organizations have a timezone setting (#183) |

**Response**

202 `{ id, list_id, status: 'pending', created_at }` with a `Location` header pointing at the document. 400 for an unknown timezone

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}`

A document's status, plus a download link once it is ready. This is the URL
POST .../documents hands back in Location; poll it until the status is no
longer `pending`. The link is a presigned object-storage URL that expires
after 5 minutes and downloads the file as an attachment named after the
list. Soft-deleted documents return 404.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at, download_url: string | null }`. `error` is a message safe to show users; `download_url` is set only when `status` is `ready`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}`

Soft-deletes a document, so the list has no current PDF until one is
generated again. The file stays in object storage; retention cleans it up
later (#174). Deleting a document that is still generating lets the render
finish but keeps its result hidden.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

204 No Content. 404 if the document is not on this list or is already deleted

---

# Members

Staff endpoints for managing organization membership and role assignments.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/members`

Returns all members of the organization with their assigned role info.

**Auth:** Staff  
**Permission:** `member:read`

**Response**

&#123; members: Array&lt;&#123; id, name, email, role_id, role_name &#125;> &#125;

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

Array of &#123; id, name, is_default, permissions: string[] &#125;

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

&#123; id, name, is_default &#125;

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Renames a role. The default (Everyone) role cannot be renamed.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | New display name for the role |

**Response**

&#123; id, name, is_default &#125;

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

&#123; ok: true &#125;

---

# Invite Links

Owner-only endpoints for token-based and slug-based org invite links.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Returns all token-based invite links for the org plus the slug invite toggle state.

**Auth:** member.invite  

**Response**

&#123; links: Array&lt;&#123; id, created_at, expires_at &#125;>, slugInviteEnabled: boolean &#125;

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

&#123; id, created_at, expires_at &#125;

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/invite-links/{id}`

Permanently revokes an invite link. The link can no longer be used to join the org.

**Auth:** member.invite  

**Response**

&#123; ok: true &#125;

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

&#123; ok: true, enabled: boolean &#125;

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

&#123; ok: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/install`

Installs and enables a plugin for the organization. Creates or re-enables
the plugin_installation record. The plugin appears in the staff nav immediately.

**Auth:** Staff  
**Permission:** `plugin:manage`

**Response**

&#123; ok: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/uninstall`

Disables a plugin for the organization. The plugin is removed from the staff nav.
Config and any plugin-stored data are retained for potential re-installation.

**Auth:** Staff  
**Permission:** `plugin:manage`

**Response**

&#123; ok: true &#125;

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/dashboard`

Returns dashboard analytics for the organization.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `range` | `string` | One of: 1w, 1m, 3m, 6m, 1y (default: 1m) |

**Response**

&#123; timeSeries: &#123; date: string, count: number &#125;[], outcomes: &#123; contact_made: boolean | null, count: number &#125;[] &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/data`

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

Array of &#123; id: string, name: string &#125;

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/locations`

Locations drawn on the admin map, for the viewport the map is showing.

The map queries by viewport rather than reusing the list page's rows because
that page is a paginated alphabetical window: a location outside the first
page is a location the map would never draw, including the one the organizer
just placed.

**Auth:** location.read  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `west,south,east,north {number} required - Viewport corners in degrees` | `any` |  |

**Response**

&#123; locations, truncated &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations`

Creates a single location in the organization's universe, as authored from
the admin map. Bulk paths live under ./import.

The location is live immediately: no location_suggestion row is written, so
nothing filters it out of universe.v_locations.

**Auth:** location.create  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | optional - Business name |
| `address_line_1` | `string` |  | optional - Street address |
| `city` | `string` |  | optional |
| `state_or_region` | `string` |  | optional |
| `postal_code` | `string` |  | optional |
| `country_code` | `string` |  | optional - Two-letter code |
| `latitude` | `number` |  | required |
| `longitude` | `number` |  | required |
| `photo_keys` | `string[]` |  | optional - Spaces object keys, max 3 |

**Response**

&#123; entity_id, id &#125;

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/universe/locations/{entity_id}`

Updates a location by superseding its current version.

Nothing is overwritten: the live row is closed and a successor inserted, and
everything pointing at the old version row is repointed by
createLocationVersion.

**Auth:** location.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Any` | `any` |  | subset of the location fields; omitted keys keep their current |

**Response**

&#123; entity_id, id &#125;

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/universe/locations/{entity_id}`

Soft-deletes a location by closing its current version without a successor.

Version history, turf assignments, and past canvassing responses are all
retained; the location simply stops appearing in universe.v_locations and in
the operational queries, which filter on valid_to.

**Auth:** location.delete  

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/edits/{id}/approve`

Accepts a canvasser's correction into the official dataset.

The correction becomes a new version of the location, so the values it
replaces stay recoverable. Where the door came from the shared public pool,
which no organization may write to, this forks an org-private copy instead
and repoints the turf assignments onto it.

**Auth:** location.update  

**Response**

&#123; entity_id, forked &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/edits/{id}/reject`

Declines a canvasser's correction.

The proposal is kept and marked rejected rather than deleted: unlike a
rejected new location, nothing bogus entered the dataset, and the record of
what was reported and turned down is worth having.

**Auth:** location.update  

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/import`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/import/overture`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/suggestions/{id}/approve`

Accepts a volunteer's field addition into the organization's universe.

Flipping the status is the whole operation: the turf assignment already
exists, and universe.v_locations stops excluding the location the moment it
is no longer tentative, so it becomes visible to search, buckets, and future
turf cuts at once.

It is deliberately not backfilled into already-cut lists — those are frozen
snapshots — so it joins the next cut instead.

**Auth:** location.create  

**Response**

&#123; entity_id &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/locations/suggestions/{id}/reject`

Rejects a volunteer's field addition and removes it entirely.

Unlike the admin delete, which is soft, this is a hard delete: a rejected
addition is bad data, and so is anything recorded against it. Deleting the
entity cascades through the location versions, the turf assignment, the
canvassing attempt, and its survey responses.

The status guard means an already-approved location cannot be destroyed
through this path; use the delete endpoint, which preserves history.

**Auth:** location.delete  

**Response**

&#123; success: true &#125;

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/metrics/results`

Returns survey responses recorded against a bucket + survey combination,
grouped by location and question, for display on the metrics results map.

**Auth:** Staff  
**Permission:** `response:read`

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bucketId` | `string` | bucket UUID |
| `surveyId` | `string` | survey UUID |
| `startDate` | `string` | optional - YYYY-MM-DD, inclusive lower bound |
| `endDate` | `string` | optional - YYYY-MM-DD, inclusive upper bound |

**Response**

Array of locations, each with a nested array of questions and their responses

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/universe/people/import`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/universe/stats`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/universe/data/integrations/api`

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/uploads/{...key}`

Redirects to a short-lived presigned GET for a stored photo.

Objects are private, so this is the only way to display one. The key prefix
check is what stops a member of one org reading another org's photos by
pasting a key; without it the bucket would have to be public.

**Auth:** Org member  

**Response**

302 to a presigned URL

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/uploads/presign`

Issues a presigned PUT so the browser can upload a location photo straight
to Spaces.

Lives outside /s/ because volunteers attach photos to their suggestions and
do not have a staff role.

Org membership is the only check needed: the key is server-generated and
unguessable, and attaching it to a location still has to pass that
endpoint's own authorization.

**Auth:** Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contentType` | `string` | ✓ | image/jpeg, image/webp, or image/png |
| `contentLength` | `number` | ✓ | Byte size, max 5,000,000 |

**Response**

&#123; url, key &#125;

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
