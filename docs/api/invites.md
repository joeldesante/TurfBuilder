# Invite Links

Owner-only endpoints for token-based and slug-based org invite links.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Returns all token-based invite links for the org plus the slug invite toggle state.

**Auth:** member.invite  

**Response**

&#123; links: Array&lt;&#123; id, created_at, expires_at &#125;>, slugInviteEnabled: boolean &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/invite-links`

Creates a new token-based invite link for the organization.
Accessible at `/invite/{token}` once created.

**Auth:** member.invite  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `expires_at` | `string | null` |  | ISO 8601 expiration date, or null for no expiry |

**Response**

&#123; id, created_at, expires_at &#125;

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/invite-links/{id}`

Permanently revokes an invite link. The link can no longer be used to join the org.

**Auth:** member.invite  

**Response**

&#123; ok: true &#125;

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/invite-links/slug`

Enables or disables the org slug-based open invite.
When enabled, anyone with the link can join at `/invite/{org_slug}`.

**Auth:** member.invite  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enabled` | `boolean` | ✓ | Whether the slug-based open invite is active |

**Response**

&#123; ok: true, enabled: boolean &#125;

---
