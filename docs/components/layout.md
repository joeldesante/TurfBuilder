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
| `infraAccess` | `boolean | undefined` | `false` |  |
| `theme` | `Theme | undefined` | `'system'` |  |
| `panelTitle` | `string | undefined` | — |  |
| `onpanelback` | `(() => void) | undefined` | — |  |
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
| `item` | `SidebarNavItem` | **required** |  |
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
