# Layout Components

## Card

**Import:** `$components/layout/card/Card.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Snippet<[]>` | **required** |  |

---

## Logo

**Import:** `$components/layout/fragments/logo/Logo.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `string | number | undefined` | — |  |
| `height` | `string | number | undefined` | — |  |
| `color` | `string | undefined` | `'var(--primary)'` |  |

---

## PageHeader

**Import:** `$components/layout/fragments/page-header/PageHeader.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** |  |
| `subheading` | `string | undefined` | — |  |
| `breadcrumbs` | `BreadcrumbItem[] | undefined` | — |  |
| `actions` | `Snippet<[]> | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## Separator

**Import:** `$components/layout/fragments/separator/Separator.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"horizontal" | "vertical" | undefined` | `'horizontal'` |  |
| `decorative` | `boolean | undefined` | `true` |  |

---

## Sidebar

**Import:** `$components/layout/fragments/sidebar/Sidebar.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nav` | `SidebarNavEntry[]` | **required** |  |
| `currentPath` | `string | undefined` | `''` |  |
| `collapsed` | `boolean | undefined` | `$bindable(false)` |  |
| `mobileOpen` | `boolean | undefined` | `$bindable(false)` |  |
| `username` | `string | undefined` | `'User'` |  |
| `applicationName` | `string | undefined` | `'TurfBuilder'` |  |
| `theme` | `Theme | undefined` | `'system'` |  |
| `panelTitle` | `string | undefined` | — |  |
| `onpanelback` | `(() => void) | undefined` | — |  |
| `orgsHref` | `string | undefined` | — | Where "Organizations" leads; omit to hide the link. |
| `onsignout` | `(() => void) | undefined` | — |  |
| `onthemechange` | `((theme: Theme) => void) | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## SidebarAccordionItem

**Import:** `$components/layout/fragments/sidebar/SidebarAccordionItem.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `accordion` | `SidebarNavAccordion` | **required** |  |
| `currentPath` | `string | undefined` | `''` |  |
| `collapsed` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## SidebarItem

**Import:** `$components/layout/fragments/sidebar/SidebarItem.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `item` | `Omit<SidebarNavItem, "href"> & { href?: string; }` | **required** | Pass an `onclick` instead of an `href` to render a button with the same look. |
| `onclick` | `((event: MouseEvent) => void) | undefined` | — |  |
| `active` | `boolean | undefined` | `false` |  |
| `collapsed` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## SidebarSection

**Import:** `$components/layout/fragments/sidebar/SidebarSection.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `section` | `SidebarNavSection` | **required** |  |
| `currentPath` | `string | undefined` | `''` |  |
| `collapsed` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## AuthLayout

**Import:** `$components/layout/layouts/auth-layout/AuthLayout.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Snippet<[]>` | **required** |  |
| `footer` | `Snippet<[]> | undefined` | — |  |
| `showLogo` | `boolean | undefined` | `true` |  |
| `title` | `string | undefined` | `''` |  |

---

## DocumentLayout

**Import:** `$components/layout/layouts/document-layout/DocumentLayout.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Snippet<[]>` | **required** |  |
| `title` | `string` | **required** |  |
| `lastUpdated` | `string | undefined` | — |  |

---

## PdfLayout

**Import:** `$components/layout/layouts/pdf-engine/PdfLayout.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pages` | `Snippet<[]>[]` | **required** |  |

---

## PdfPage

**Import:** `$components/layout/layouts/pdf-engine/pdf-page/PdfPage.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `"Letter" | "A4"` | **required** |  |
| `margins` | `PageMargins | undefined` | `{
			top: '1in',
			bottom: '1in',
			left: '1in',
			right: '1in'
		}` |  |
| `showMarginGuides` | `boolean | undefined` | `false` |  |
| `children` | `Snippet<[]>` | **required** |  |

---

## ReorderList

A row or column of items that can be dragged into a new order, by mouse or
by touch, with the other items sliding out of the way. This is the one
place reordering is built, so every reorderable list moves the same way.

**Import:** `$components/layout/reorder-list/ReorderList.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ids` | `string[]` | **required** | The item ids in their saved order. |
| `onReorder` | `((ids: string[]) => void | Promise<void>) | undefined` | — | Called once when a drag ends with a different order. If it rejects, the
items go back to `ids`. Without it the items cannot be dragged. |
| `axis` | `"x" | "y" | undefined` | `'x'` | Which way the items lay out. |
| `as` | `"ul" | "ol" | "div" | undefined` | `'ul'` | Tag of the list. |
| `itemAs` | `"div" | "li" | undefined` | `'li'` | Tag of each item. |
| `class` | `string | undefined` | `''` |  |
| `itemClass` | `((id: string, dragging: boolean) => string) | undefined` | — | Extra classes for an item; `dragging` is true while it is held. |
| `itemProps` | `((id: string) => Record<string, unknown>) | undefined` | — | Extra attributes for an item, such as `role` or `aria-selected`. |
| `item` | `Snippet<[id: string, dragging: boolean]>` | **required** | The content of one item. |

---

## SnippetHost

Renders one snippet with one argument. Lets imperative code, such as a map
popup that `mount()`s its own content, show a snippet a parent passed in.

**Import:** `$components/layout/snippet-host/SnippetHost.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `snippet` | `Snippet<[T]>` | **required** |  |
| `arg` | `T` | **required** |  |

---

## TabBar

**Import:** `$components/layout/tab-bar/TabBar.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Tab[]` | **required** |  |
| `activeId` | `string` | **required** |  |
| `onSelect` | `(id: string) => void` | **required** |  |
| `onAdd` | `() => void` | **required** |  |
| `onClose` | `(id: string) => void` | **required** |  |
| `onReorder` | `(tabs: Tab[]) => void` | **required** |  |

---

## Tabs

**Import:** `$components/layout/tabs/Tabs.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Tab[]` | **required** |  |
| `active` | `string` | **required** | The id of the tab being shown. |
| `label` | `string` | **required** | Names the tab list for screen readers. |
| `onSelect` | `((id: string) => void) | undefined` | — | Called with the tab's id when a tab without an `href` is pressed. |
| `class` | `string | undefined` | `''` |  |

---
