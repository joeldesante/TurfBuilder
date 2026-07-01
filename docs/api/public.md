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
