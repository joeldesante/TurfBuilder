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
