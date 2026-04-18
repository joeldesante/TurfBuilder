# Invite Links

Owner-only endpoints for token-based and slug-based org invite links.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Returns all token-based invite links for the org plus the slug invite toggle state.

**Auth:** 👑 Owner only  

**Response**

{ links: Array<{ id, created_at, expires_at }>, slugInviteEnabled: boolean }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Creates a new token-based invite link for the organization.
Accessible at `/invite/{token}` once created.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `expires_at` | `string | null` |  | ISO 8601 expiration date, or null for no expiry |

**Response**

{ id, created_at, expires_at }

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/invite-links/{id}`

Permanently revokes an invite link. The link can no longer be used to join the org.

**Auth:** 👑 Owner only  

**Response**

{ ok: true }

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/invite-links/slug`

Enables or disables the org slug-based open invite.
When enabled, anyone with the link can join at `/invite/{org_slug}`.

**Auth:** 👑 Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enabled` | `boolean` | ✓ | Whether the slug-based open invite is active |

**Response**

{ ok: true, enabled: boolean }

---
