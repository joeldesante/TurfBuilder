---
layout: home

hero:

features:
  - icon: 📡
    title: API Reference
    details: All HTTP endpoints — public, volunteer-facing, and staff-facing — with auth requirements, request bodies, and responses.
    link: /api/
  - icon: 🎨
    title: Component Library
    details: Reusable Svelte 5 UI primitives with props, defaults, and usage. All components use runes syntax.
    link: /components/
  - icon: 🧩
    title: Plugin System
    details: Available plugins and how to build new ones. Plugins can add pages, API handlers, and event hooks.
    link: /plugins/
---

## Quick reference

| | |
|---|---|
| **Route prefix** | `/o/[org_slug]/` (volunteer) · `/o/[org_slug]/s/` (staff) |
| **Auth** | better-auth at `/auth/**` — do not modify |
| **Permissions** | `can(org, resource, action)` from `$lib/auth-helpers` |
| **Database** | `withOrgTransaction` for org-scoped writes · `POOL` for reads |
| **Path aliases** | `$components` · `$pages` · `$config` · `$plugins` |

> Regenerate these docs from source: `npm run docs`
