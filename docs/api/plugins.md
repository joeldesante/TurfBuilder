# Plugins

Staff endpoints for installing, configuring, and routing to plugin-defined API handlers.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/config`

Updates the stored configuration for an installed plugin.
If the plugin defines a `configSchema` (Zod), the body is validated before saving.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `(plugin-defined) - JSON config object validated against the plugin's configSchema if present` | `any` |  |  |

**Response**

{ ok: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/install`

Installs and enables a plugin for the organization. Creates or re-enables
the plugin_installation record. The plugin appears in the staff nav immediately.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/plugins/{slug}/uninstall`

Disables a plugin for the organization. The plugin is removed from the staff nav.
Config and any plugin-stored data are retained for potential re-installation.

**Auth:** 👤 Staff  
**Permission:** `plugin:manage`

**Response**

{ ok: true }

---
