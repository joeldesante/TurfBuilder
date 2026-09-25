# Members

Staff endpoints for managing organization membership and role assignments.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/members`

Returns all members of the organization with their assigned role info.

**Auth:** Staff  
**Permission:** `member:read`

**Response**

&#123; members: Array&lt;&#123; id, name, email, role_id, role_name &#125;> &#125;

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/members/{user_id}/permissions`

---
