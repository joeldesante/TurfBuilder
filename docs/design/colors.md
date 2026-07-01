# Color Tokens

TurfBuilder's color system is based on [Material 3 color roles](https://m3.material.io/styles/color/roles). Every token is available as a Tailwind utility class (`bg-*`, `text-*`, `border-*`) and as a CSS custom property (`var(--token-name)`).

The theme switches automatically based on OS preference. Dark mode values are defined in `src/app.css` under `:root[data-theme='dark']`.

## Primary

The main brand color and its companions. Use for primary actions, interactive elements, and key brand accents.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `primary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#047857;border:1px solid transparent;vertical-align:middle"></span> | Main brand color. Use for primary buttons, links, active nav items, and focus rings. |
| `on-primary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed directly on a `primary` background. |
| `primary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#d1fae5;border:1px solid #a1a1aa;vertical-align:middle"></span> | Softer primary-tinted background. Use for chips, selected rows, and highlights. |
| `on-primary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#064e3b;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on a `primary-container` background. |

## Secondary

A complementary neutral accent. Use for less prominent interactive elements and supporting UI.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `secondary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#52525b;border:1px solid transparent;vertical-align:middle"></span> | Secondary action color. Use for secondary buttons and less prominent controls. |
| `on-secondary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on a `secondary` background. |
| `secondary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#d4d4d8;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft secondary tint. Use for tags, secondary chips, or filter badges. |
| `on-secondary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#18181b;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on a `secondary-container` background. |

## Tertiary

An optional third accent for decorative or distinguishing UI. Use sparingly.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `tertiary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#0d9488;border:1px solid transparent;vertical-align:middle"></span> | Tertiary accent. Use to visually distinguish a third category or accent alongside primary and secondary. |
| `on-tertiary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on a `tertiary` background. |
| `tertiary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ccfbf1;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft tertiary tint. Use for decorative section backgrounds or grouping highlights. |
| `on-tertiary-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#134e4a;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on a `tertiary-container` background. |

## Error

Signals destructive or invalid states — validation failures, delete confirmations, and critical alerts.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `error` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#dc2626;border:1px solid transparent;vertical-align:middle"></span> | Use for error text, destructive action buttons, and form validation failure indicators. |
| `on-error` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on an `error` background. |
| `error-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#fee2e2;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft error tint. Use for inline error banners, invalid field backgrounds, or alert boxes. |
| `on-error-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#7f1d1d;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on an `error-container` background. |

## Info

Signals informational content that is neutral and non-urgent.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `info` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#2563eb;border:1px solid transparent;vertical-align:middle"></span> | Use for informational badges, help text callouts, and status indicators. |
| `on-info` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on an `info` background. |
| `info-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#dbeafe;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft info tint. Use for info banners, instructional callout boxes, or tooltip backgrounds. |
| `on-info-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#1e3a8a;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on an `info-container` background. |

## Success

Signals a positive, completed, or confirmed state.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `success` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#16a34a;border:1px solid transparent;vertical-align:middle"></span> | Use for success toasts, completion checkmarks, and positive status indicators. |
| `on-success` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on a `success` background. |
| `success-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#dcfce7;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft success tint. Use for success banners or confirmed-state row highlights. |
| `on-success-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#14532d;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on a `success-container` background. |

## Warning

Signals a cautionary state that needs attention but is not a blocking error.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `warning` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#d97706;border:1px solid transparent;vertical-align:middle"></span> | Use for warning badges, advisory alerts, and caution indicators. |
| `on-warning` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons placed on a `warning` background. |
| `warning-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#fef3c7;border:1px solid #a1a1aa;vertical-align:middle"></span> | Soft warning tint. Use for advisory banners or rows requiring user attention. |
| `on-warning-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#78350f;border:1px solid transparent;vertical-align:middle"></span> | Text and icons placed on a `warning-container` background. |

## Surface

The layered neutral backgrounds that make up the app shell. Based on Material 3 surface roles — higher "container" levels sit visually higher in the hierarchy.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `surface` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#fafafa;border:1px solid #a1a1aa;vertical-align:middle"></span> | Default page/app background. Applied to `<body>` and full-bleed layouts. |
| `on-surface` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#18181b;border:1px solid transparent;vertical-align:middle"></span> | Primary body text and icons on any surface background. |
| `surface-subtle` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#f4f4f5;border:1px solid #a1a1aa;vertical-align:middle"></span> | Slightly elevated surface. Use for sidebar backgrounds, striped table rows, or inset areas. |
| `on-surface-subtle` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#52525b;border:1px solid transparent;vertical-align:middle"></span> | De-emphasized text — placeholders, secondary labels, metadata. |
| `surface-dim` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#f4f4f5;border:1px solid #a1a1aa;vertical-align:middle"></span> | Dimmed surface for disabled regions or content behind a scrim. |
| `surface-bright` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Brightest surface. Use for modal backgrounds and the top layer of stacked cards. |
| `surface-container-lowest` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Lowest elevation container. Use for inset or recessed content wells. |
| `surface-container-low` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#fafafa;border:1px solid #a1a1aa;vertical-align:middle"></span> | Low elevation container. Use for list backgrounds or page section fills. |
| `surface-container` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#f4f4f5;border:1px solid #a1a1aa;vertical-align:middle"></span> | Standard card and panel background. |
| `surface-container-high` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#e4e4e7;border:1px solid #a1a1aa;vertical-align:middle"></span> | Elevated card background. Use for hover states or raised panels. |
| `surface-container-highest` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#d4d4d8;border:1px solid #a1a1aa;vertical-align:middle"></span> | Highest elevation container. Use for dropdown menus, popovers, or floating elements. |

## Outline

Border and divider colors.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `outline` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#d4d4d8;border:1px solid #a1a1aa;vertical-align:middle"></span> | Standard border for inputs, cards, and dividers. |
| `outline-subtle` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#e4e4e7;border:1px solid #a1a1aa;vertical-align:middle"></span> | Subtle divider lines. Use for section separators and de-emphasized borders. |

## Inverse

Flipped-theme surfaces for snackbars, toasts, and tooltip-style elements that must stand out against the default background.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `inverse-surface` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#27272a;border:1px solid transparent;vertical-align:middle"></span> | Dark background for toasts and snackbars in light mode. |
| `inverse-on-surface` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#f4f4f5;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text on an `inverse-surface` background. |
| `inverse-primary` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#6ee7b7;border:1px solid transparent;vertical-align:middle"></span> | Primary accent color rendered on an inverse surface (e.g. a link inside a dark toast). |

## Location Status

Semantic colors for canvassing location markers on the map and in lists. Each has an `on-*` companion for text/icon contrast.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `location-unvisited` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#3b82f6;border:1px solid transparent;vertical-align:middle"></span> | Location has not yet been visited during this canvass. |
| `on-location-unvisited` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons on a `location-unvisited` background. |
| `location-contacted` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#15803d;border:1px solid transparent;vertical-align:middle"></span> | Canvasser made successful contact at this location. |
| `on-location-contacted` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons on a `location-contacted` background. |
| `location-no-contact` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#a1a1aa;border:1px solid transparent;vertical-align:middle"></span> | Canvasser visited but no one answered. |
| `on-location-no-contact` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#27272a;border:1px solid transparent;vertical-align:middle"></span> | Text and icons on a `location-no-contact` background. |
| `location-hostile` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#991b1b;border:1px solid transparent;vertical-align:middle"></span> | Location is marked do-not-contact or was hostile. |
| `on-location-hostile` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#ffffff;border:1px solid #a1a1aa;vertical-align:middle"></span> | Text and icons on a `location-hostile` background. |

## Utility

Miscellaneous tokens for overlays and shadows.

| Token | &nbsp; | Description |
|-------|:------:|-------------|
| `scrim` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:rgba(0,0,0,0.5);border:1px solid transparent;vertical-align:middle"></span> | Semi-transparent black overlay used behind modals, drawers, and bottom sheets. |
| `shadow` | <span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:#000000;border:1px solid transparent;vertical-align:middle"></span> | Color used for drop shadows on elevated surfaces. |
