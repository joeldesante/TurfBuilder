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
