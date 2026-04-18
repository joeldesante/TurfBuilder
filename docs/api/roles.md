# Roles & Permissions

Owner-only endpoints for managing custom staff roles and their permission sets.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/roles`

Returns all custom roles for the organization, each with their permission set.

**Auth:** 👤 Staff  
**Permission:** `member:read`

**Response**

Array of { id, name, is_owner, is_default, permissions: string[] }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/roles`

Creates a new custom staff role for the organization.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Display name for the new role |

**Response**

{ id, name, is_owner, is_default }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Renames a custom role. System roles (is_owner = true) cannot be renamed.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | New display name for the role |

**Response**

{ id, name, is_owner, is_default }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Permanently deletes a custom role. System roles and the default role cannot be deleted.

**Auth:** 👑 Owner only  

**Response**

204 No Content on success

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/roles/{id}/permissions`

Replaces the full permission set for a role. Any permissions not in the submitted
list are removed. Each entry must be a valid `resource:action` key.
Valid resources: canvass, turf, survey, response, member, plugin.
Valid actions: use, create, read, update, delete.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `permissions` | `string[]` | ✓ | Full list of resource:action strings to assign |

**Response**

{ ok: true }

---
