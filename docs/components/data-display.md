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

## LineChart

**Import:** `$components/data-display/charts/LineChart/LineChart.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string | undefined` | — |  |
| `subtitle` | `string | undefined` | — |  |
| `options` | `Plot.PlotOptions` | **required** |  |

---

## PieChart

**Import:** `$components/data-display/charts/PieChart/PieChart.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string | undefined` | — |  |
| `subtitle` | `string | undefined` | — |  |
| `data` | `Slice[]` | **required** |  |
| `radius` | `number | undefined` | `120` | Outer radius in pixels. |
| `innerRadius` | `number | undefined` | `0` | Inner radius for donut. 0 = full pie. |
| `tooltip` | `boolean | undefined` | `true` | Show value tooltips on hover. |
| `legend` | `boolean | undefined` | `false` | Show legend. |
| `colors` | `readonly string[] | undefined` | `d3.schemeTableau10` | Color scheme. |

---

## DataTable

**Import:** `$components/data-display/data-table/DataTable.svelte`

---

## EntityBrowserRow

**Import:** `$components/data-display/entity-browser/EntityBrowserRow.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | **required** |  |
| `date` | `string | Date` | **required** |  |
| `href` | `string` | **required** |  |
| `icon` | `Component<{}, {}, string> | undefined` | — |  |

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
