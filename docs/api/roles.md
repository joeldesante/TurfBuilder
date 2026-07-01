# Roles & Permissions

Owner-only endpoints for managing custom staff roles and their permission sets.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/roles`

Returns all roles for the organization, each with their permission set.

**Auth:** role.read  

**Response**

Array of { id, name, is_default, permissions: string[] }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/roles`

Creates a new role for the organization.

**Auth:** role.create  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Display name for the new role |
| `weight` | `number` |  | optional - Priority weight (lower = higher priority) |

**Response**

{ id, name, is_default }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Renames a role. The default (Everyone) role cannot be renamed.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | New display name for the role |

**Response**

{ id, name, is_default }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/roles/{id}`

Permanently deletes a role. The default (Everyone) role cannot be deleted.

**Auth:** role.delete  

**Response**

204 No Content on success

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/roles/{id}/permissions`

Replaces the full permission set for a role.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `permissions` | `string[]` | ✓ | Full list of resource.action keys to grant |

**Response**

{ ok: true }

---
