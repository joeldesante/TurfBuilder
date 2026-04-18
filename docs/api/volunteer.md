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
