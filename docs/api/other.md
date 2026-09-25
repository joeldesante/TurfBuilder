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
