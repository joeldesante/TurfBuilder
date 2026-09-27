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
