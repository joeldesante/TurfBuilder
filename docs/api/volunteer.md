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
