# Members

Staff endpoints for managing organization membership and role assignments.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/members`

Returns all members of the organization with their assigned role info.

**Auth:** 👤 Staff  
**Permission:** `member:read`

**Response**

{ members: Array<{ id, name, email, role_id, role_name }> }

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

Assigns or removes a role for an org member.
Blocked if the target is the last administrator and the new role is not also an owner role.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role_id` | `string | null` | ✓ | Role UUID to assign, or null to remove the role |

**Response**

{ ok: true }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

Removes a member from the organization entirely.
Blocked if the target is the last administrator (uses FOR UPDATE lock to prevent race conditions).

**Auth:** 👤 Staff  
**Permission:** `member:delete`

**Response**

{ ok: true }

---
