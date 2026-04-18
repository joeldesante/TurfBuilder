# Data-display Components

## AdaptiveDataGrid

**Import:** `$components/data-display/adaptive-datagrid/AdaptiveDataGrid.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `Column[]` | **required** |  |
| `data` | `Record<string, unknown>[]` | **required** |  |
| `readonly` | `boolean | undefined` | `false` |  |
| `loading` | `boolean | undefined` | `false` |  |
| `onchange` | `((rowIndex: number, key: string, value: string) => void) | undefined` | — |  |
| `oncolumnadd` | `((col: Column) => void) | undefined` | — |  |
| `onloadmore` | `(() => void) | undefined` | — |  |

---

## Avatar

**Import:** `$components/data-display/avatar/Avatar.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `username` | `string` | **required** |  |
| `size` | `"sm" | "md" | "lg" | undefined` | `'md'` |  |
| `variant` | `Variant | undefined` | `'default'` |  |
| `class` | `string | undefined` | `''` |  |

---

## Badge

Small pill label for status, categories, and location visit states.

**Import:** `$components/data-display/badge/Badge.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" | "primary" | "secondary" | "success" | "warning" | "error" | "info...` | `'default'` | Color scheme. Location variants map directly to canvassing contact states. |
| `size` | `"sm" | "md" | undefined` | `'md'` | Display size. |
| `children` | `Snippet<[]>` | **required** |  |

---

## DataTable

**Import:** `$components/data-display/data-table/DataTable.svelte`

---

## MapMarker

**Import:** `$components/data-display/map-marker/MapMarker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `Variant | undefined` | `'unvisited'` |  |
| `isSelected` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## MapPopup

**Import:** `$components/data-display/map-popup/MapPopup.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `locationName` | `string` | **required** |  |
| `street` | `string | null | undefined` | `null` |  |
| `locality` | `string | null | undefined` | `null` |  |

---

## Qrcode

**Import:** `$components/data-display/qrcode/Qrcode.svelte`

---
