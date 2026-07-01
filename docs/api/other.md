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
