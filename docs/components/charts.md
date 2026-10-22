# Charts

A small D3 chart library in `src/stories/components/data-display/charts/`. Nothing in it knows about infrastructure, so organization dashboards can use it the same way. Colors come from the `--chart-*` tokens in `src/lib/chart-tokens.css`, which are checked for color-vision differences; charts assign them in a fixed order and never cycle.

## Data shapes

Defined in `$lib/shared/types/charts.ts`, so server output plugs in directly.

| Type | Shape |
|---|---|
| `TimePoint` | `{ date: 'YYYY-MM-DD', value }` |
| `TimeSeries` | `{ key, label, points: TimePoint[], color?, dashed? }` |
| `CategoryDatum` | `{ key, label, value, color? }` |
| `MatrixCell` | `{ row, col, value }` |
| `Granularity` | `'day' \| 'week' \| 'month'` |

## Components

All take `title`, optional `subtitle`, `loading`, `error`, `emptyText`, `csvFilename` (adds a download), and `class`.

| Component | Use it for | Notable props |
|---|---|---|
| `LineChart` | Change over time | `series`, `granularity`, `format`, `area`, `stacked`, `smooth` |
| `BarChart` | Rankings (`data`) or buckets over time (`series`) | `orientation`, `stacked`, `href` |
| `DonutChart` | Parts of a whole; long tails fold into "Other" | `data`, `maxSlices`, `centerLabel` |
| `Heatmap` | Two-way tables such as retention | `cells`, `rows`, `cols`, `max` |
| `Sparkline` | A trend with no axes | `points` |
| `StatTile` | A headline figure with change against the previous period | `value`, `change`, `goodDirection`, `trend` |
| `RangePicker` | Range and granularity control | `range`, `granularity`, `onchange` |

Every chart has `role="img"` with a generated summary, a visually hidden data table, a legend for two or more series (direct labels for up to four), keyboard-driven crosshairs, and respects reduced motion.

## Feeding a chart from the database

`time-series.service.ts` builds a zero-filled series from an allow-listed source. Use it with `POOL` for platform tables, or inside `withOrgTransaction` for organization tables:

```ts
import { timeSeries } from '$lib/server/services/time-series.service';

const points = await withOrgTransaction(orgId, (client) =>
  timeSeries(client, { source: 'canvass_visits', from, to, granularity: 'week', orgId })
);
```

```svelte
<LineChart title="Visits" series={[{ key: 'visits', label: 'Visits', points }]} granularity="week" />
```

Pure helpers for bucketing, zero filling, rolling averages, CSV, and formatting are in `$lib/shared/utils/chart-series.ts` and `chart-format.ts`.
