# Data-display Components

## ActivityFeed

**Import:** `$components/data-display/activity-feed/ActivityFeed.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `ActivityEntry[]` | **required** |  |
| `showUser` | `boolean | undefined` | `true` | Name the person in each row; off on a user's own page. |
| `showOrg` | `boolean | undefined` | `true` | Name the organization in each row; off on an org's own page. |
| `userHref` | `((id: string) => string) | undefined` | — | Where a person's name links to; no links when omitted. |
| `orgHref` | `((id: string) => string) | undefined` | — |  |
| `emptyText` | `string | undefined` | `'Nothing has happened yet.'` |  |

---

## ActivityMap

**Import:** `$components/data-display/activity-map/ActivityMap.svelte`

---

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

## AuditLogTable

**Import:** `$components/data-display/audit-log-table/AuditLogTable.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `AuditEntry[]` | **required** |  |
| `showTarget` | `boolean | undefined` | `true` | Show what each change was made to; off on a target's own page. |
| `targetHref` | `((type: AuditEntry["targetType"], id: string) => string | null) | undefined` | — | Where a target links to, by type and id; plain text when it returns null. |
| `emptyText` | `string | undefined` | `'No changes recorded.'` |  |

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

## BarChart

**Import:** `$components/data-display/charts/BarChart/BarChart.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subtitle` | `string | undefined` | — |  |
| `data` | `CategoryDatum[] | undefined` | — | Categories, one bar each: a ranking such as top organizations. |
| `series` | `TimeSeries[] | undefined` | — | Time buckets instead of categories, one bar (or stack) per bucket. |
| `granularity` | `Granularity | undefined` | `'day'` |  |
| `orientation` | `"horizontal" | "vertical" | undefined` | `'horizontal'` | For categories: horizontal reads best for long labels. Time series are always vertical. |
| `stacked` | `boolean | undefined` | `true` | For several series: stack them (parts of a whole) or set them side by side. |
| `format` | `ValueFormat | undefined` | `'number'` |  |
| `valueLabels` | `boolean | undefined` | — | Print each bar's value at its end. Defaults on for horizontal bars. |
| `height` | `number | undefined` | — | Plot height in px; horizontal bars size themselves to their rows when omitted. |
| `href` | `((datum: CategoryDatum) => string | undefined) | undefined` | — | Href for each category's label, such as its detail page. |
| `loading` | `boolean | undefined` | `false` |  |
| `error` | `string | null | undefined` | `null` |  |
| `emptyText` | `string | undefined` | — |  |
| `csvFilename` | `string | undefined` | — |  |
| `class` | `string | undefined` | `''` | Classes for the chart card, such as a grid span. |

---

## ChartFrame

**Import:** `$components/data-display/charts/ChartFrame/ChartFrame.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subtitle` | `string | undefined` | — |  |
| `height` | `number | undefined` | `240` | Height of the plot area in px; the frame reserves it before the chart draws, so nothing jumps. |
| `loading` | `boolean | undefined` | `false` |  |
| `error` | `string | null | undefined` | `null` | Shown in place of the chart. Write it for people. |
| `empty` | `boolean | undefined` | `false` | True when there is nothing to draw. |
| `emptyText` | `string | undefined` | `'No data for this period.'` |  |
| `csv` | `(() => string) | undefined` | — | Builds the chart's data as CSV; adds a download button when given. |
| `csvFilename` | `string | undefined` | — |  |
| `actions` | `Snippet<[]> | undefined` | — | Extra controls in the header, beside the download button. |
| `legend` | `Snippet<[]> | undefined` | — | The legend, between the header and the plot. |
| `children` | `Snippet<[number]>` | **required** | The plot, given the measured width in px. Not rendered until the width is known. |
| `table` | `Snippet<[]> | undefined` | — | The same data as a table, for screen readers. |
| `class` | `string | undefined` | `''` |  |

---

## ChartTooltip

**Import:** `$components/data-display/charts/ChartTooltip/ChartTooltip.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `heading` | `string` | **required** |  |
| `rows` | `Row[]` | **required** |  |
| `x` | `number` | **required** | Left offset in px within the chart's plot area. |
| `y` | `number` | **required** | Top offset in px within the chart's plot area. |
| `containerWidth` | `number | undefined` | — | Width of the plot area; the tooltip flips to the left of x past its middle so it never overflows. |
| `flip` | `boolean | undefined` | — | Forces the side; overrides containerWidth. |

---

## DonutChart

**Import:** `$components/data-display/charts/DonutChart/DonutChart.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subtitle` | `string | undefined` | — |  |
| `data` | `CategoryDatum[]` | **required** |  |
| `format` | `ValueFormat | undefined` | `'number'` |  |
| `innerRadius` | `number | undefined` | `0.62` | Hole size as a share of the radius: 0 draws a pie. |
| `maxSlices` | `number | undefined` | `6` | Slices kept before the rest fold into "Other". At most 8. |
| `centerLabel` | `string | undefined` | `'Total'` | Text in the hole; defaults to the total. |
| `centerValue` | `string | undefined` | — |  |
| `height` | `number | undefined` | `200` | Plot height in px. |
| `loading` | `boolean | undefined` | `false` |  |
| `error` | `string | null | undefined` | `null` |  |
| `emptyText` | `string | undefined` | — |  |
| `csvFilename` | `string | undefined` | — |  |
| `class` | `string | undefined` | `''` | Classes for the chart card, such as a grid span. |

---

## Heatmap

**Import:** `$components/data-display/charts/Heatmap/Heatmap.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subtitle` | `string | undefined` | — |  |
| `cells` | `MatrixCell[]` | **required** |  |
| `rows` | `string[]` | **required** | Row keys in display order. |
| `cols` | `string[]` | **required** | Column keys in display order. |
| `rowLabel` | `((row: string) => string) | undefined` | `(r) => r` |  |
| `colLabel` | `((col: string) => string) | undefined` | `(c) => c` |  |
| `format` | `ValueFormat | undefined` | `'number'` |  |
| `max` | `number | undefined` | — | The color scale's top; defaults to the largest value. Use 1 for shares. |
| `cellLabels` | `boolean | undefined` | `true` | Print each cell's value inside it, when cells are wide enough. |
| `rowTitle` | `string | undefined` | `'Row'` | What the rows and columns are, for the table and tooltip. |
| `colTitle` | `string | undefined` | `'Column'` |  |
| `loading` | `boolean | undefined` | `false` |  |
| `error` | `string | null | undefined` | `null` |  |
| `emptyText` | `string | undefined` | — |  |
| `csvFilename` | `string | undefined` | — |  |
| `class` | `string | undefined` | `''` | Classes for the chart card, such as a grid span. |

---

## Legend

**Import:** `$components/data-display/charts/Legend/Legend.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `LegendItem[]` | **required** |  |
| `hidden` | `string[] | undefined` | `[]` | Keys of series hidden from the chart. |
| `ontoggle` | `((key: string) => void) | undefined` | — | Makes each item a toggle that hides or shows its series. |
| `vertical` | `boolean | undefined` | `false` | Stack the items, one per line, as beside a donut. |

---

## LineChart

**Import:** `$components/data-display/charts/LineChart/LineChart.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subtitle` | `string | undefined` | — |  |
| `series` | `TimeSeries[]` | **required** |  |
| `granularity` | `Granularity | undefined` | `'day'` |  |
| `format` | `ValueFormat | undefined` | `'number'` |  |
| `height` | `number | undefined` | `240` | Plot height in px. |
| `area` | `boolean | undefined` | `false` | Fills under each line. With one series this is a soft area; with several, use `stacked`. |
| `stacked` | `boolean | undefined` | `false` | Stacks the series as areas, for parts of a whole over time. |
| `smooth` | `boolean | undefined` | `false` | Curved lines instead of straight segments. |
| `loading` | `boolean | undefined` | `false` |  |
| `error` | `string | null | undefined` | `null` |  |
| `emptyText` | `string | undefined` | — |  |
| `csvFilename` | `string | undefined` | — | Adds a CSV download named this. |
| `class` | `string | undefined` | `''` | Classes for the chart card, such as a grid span. |

---

## Sparkline

**Import:** `$components/data-display/charts/Sparkline/Sparkline.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `points` | `TimePoint[]` | **required** |  |
| `label` | `string` | **required** | Names the trend for screen readers, such as "Sign-ups, last 30 days". |
| `height` | `number | undefined` | `32` |  |
| `color` | `string | undefined` | `'var(--chart-1)'` |  |
| `area` | `boolean | undefined` | `true` | Fill under the line. |

---

## DataTable

**Import:** `$components/data-display/data-table/DataTable.svelte`

---

## EmailLogTable

**Import:** `$components/data-display/email-log-table/EmailLogTable.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `EmailLogEntry[]` | **required** |  |
| `showRecipient` | `boolean | undefined` | `true` | Show who each email went to; off on a user's own page. |
| `emptyText` | `string | undefined` | `'No emails sent.'` |  |

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

## LocationsMap

**Import:** `$components/data-display/locations-map/LocationsMap.svelte`

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

## Pagination

**Import:** `$components/data-display/pagination/Pagination.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `page` | `number` | **required** | 1-based number of the page being shown. |
| `totalCount` | `number` | **required** | Rows across all pages. |
| `pageSize` | `number` | **required** |  |
| `noun` | `string | undefined` | `'records'` | What the rows are, plural, for the summary: "Showing 1-100 of 250 locations." |
| `children` | `Snippet<[]> | undefined` | — | Extra text after the summary, such as a pointer to search. |
| `href` | `((page: number) => string) | undefined` | — | The link for a page. Defaults to `?page=N`; pass one that keeps the page's other query parameters, such as a search. |

---

## Qrcode

**Import:** `$components/data-display/qrcode/Qrcode.svelte`

---

## SqlPreview

**Import:** `$components/data-display/sql-preview/SqlPreview.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sql` | `string` | **required** | A parameterized query, laid out and colored for reading. |
| `params` | `unknown[] | undefined` | `[]` | The values for `$1`, `$2`, ... listed under the query. |
| `label` | `string | undefined` | `'Generated SQL'` | Accessible name of the query block. |

---

## StatTile

**Import:** `$components/data-display/stat-tile/StatTile.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | **required** |  |
| `value` | `string | number` | **required** |  |
| `format` | `ValueFormat | undefined` | `'number'` |  |
| `change` | `number | null | undefined` | — | Change against the previous period as a fraction (0.12 is up 12%); null when there was nothing before. Omit for none. |
| `goodDirection` | `"up" | "down" | "none" | undefined` | `'up'` | Which way is good: more sign-ups is up, more failed emails is down. |
| `changeLabel` | `string | undefined` | — | What the change compares against, such as "vs the 7 days before". |
| `trend` | `TimePoint[] | undefined` | — | A small trend under the value. |
| `hint` | `string | undefined` | — | Extra context under the value. |
| `href` | `string | undefined` | — | Makes the tile a link, such as to the full chart. |

---
