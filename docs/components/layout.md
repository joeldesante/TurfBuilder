# Layout Components

## PageHeader

**Import:** `$components/layout/page-header/PageHeader.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subheading` | `string | undefined` | — |  |
| `breadcrumbs` | `BreadcrumbItem[] | undefined` | — |  |
| `actions` | `Snippet<[]> | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## Sidebar

**Import:** `$components/layout/sidebar/Sidebar.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nav` | `SidebarNavEntry[]` | **required** |  |
| `currentPath` | `string | undefined` | `''` |  |
| `collapsed` | `boolean | undefined` | `$bindable(false)` |  |
| `mobileOpen` | `boolean | undefined` | `$bindable(false)` |  |
| `username` | `string | undefined` | `'User'` |  |
| `theme` | `Theme | undefined` | `'system'` |  |
| `onsignout` | `(() => void) | undefined` | — |  |
| `onthemechange` | `((theme: Theme) => void) | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## SidebarItem

**Import:** `$components/layout/sidebar/SidebarItem.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `item` | `SidebarNavItem` | **required** |  |
| `active` | `boolean | undefined` | `false` |  |
| `collapsed` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## SidebarSection

**Import:** `$components/layout/sidebar/SidebarSection.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `section` | `SidebarNavSection` | **required** |  |
| `currentPath` | `string | undefined` | `''` |  |
| `collapsed` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---
