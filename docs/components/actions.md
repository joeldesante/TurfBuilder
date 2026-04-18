# Actions Components

## Button

Primary action element. Renders as a `<button>` or `<a>` depending on whether `href` is provided.

**Import:** `$components/actions/button/Button.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Snippet<[]>` | **required** |  |
| `variant` | `Variant | undefined` | `'primary'` | Visual style variant. |
| `size` | `Size | undefined` | `'default'` | Button size. |
| `type` | `ButtonType | undefined` | `'button'` | HTML button type attribute. |
| `href` | `string | undefined` | — | When provided the button renders as an anchor tag. |
| `disabled` | `boolean | undefined` | `false` | Disables interaction and reduces opacity. |
| `loading` | `boolean | undefined` | `false` | Shows a spinner and blocks clicks without disabling the element. |
| `iconOnly` | `boolean | undefined` | `false` | Set when the button contains only an icon — requires `aria-label` for accessibility. |
| `aria-label` | `string | undefined` | — | Required when `iconOnly` is true. |
| `class` | `string | undefined` | `''` | Additional CSS classes. |

---

## CopyButton

**Import:** `$components/actions/copy-button/CopyButton.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | **required** |  |
| `aria-label` | `string | undefined` | `'Copy to clipboard'` |  |
| `class` | `string | undefined` | `''` |  |

---

## DropdownMenu

**Import:** `$components/actions/dropdown-menu/DropdownMenu.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Snippet<[]>` | **required** |  |
| `items` | `DropdownMenuEntry[]` | **required** |  |
| `open` | `boolean | undefined` | `$bindable(false)` |  |
| `align` | `"start" | "center" | "end" | undefined` | `'end'` |  |
| `side` | `"top" | "bottom" | "left" | "right" | undefined` | `'bottom'` |  |
| `sideOffset` | `number | undefined` | `4` |  |
| `class` | `string | undefined` | `''` |  |

---
