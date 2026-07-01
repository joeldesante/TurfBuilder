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
