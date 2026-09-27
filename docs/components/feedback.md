# Feedback Components

## ConfirmDialog

**Import:** `$components/feedback/confirm-dialog/ConfirmDialog.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** |  |
| `title` | `string` | **required** |  |
| `description` | `string | undefined` | — | Body copy. Say what will happen and whether it can be undone. |
| `confirmLabel` | `string | undefined` | — |  |
| `cancelLabel` | `string | undefined` | — |  |
| `destructive` | `boolean | undefined` | — | Styles the confirm button as destructive. |
| `loading` | `boolean | undefined` | — | Set while the confirm action is in flight. |
| `error` | `string | null | undefined` | — | Surfaced above the buttons when the action fails. |
| `onConfirm` | `() => void` | **required** |  |
| `onCancel` | `() => void` | **required** |  |
| `children` | `any` | — |  |

---

## Spinner

**Import:** `$components/feedback/spinner/Spinner.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number | undefined` | `20` |  |
| `class` | `string | undefined` | `''` |  |

---

## Toaster

Shows toast notifications raised anywhere with `toast()`, `toast.error()` or
`toast.success()` from `svelte-sonner`. Mounted once in the root layout, so
pages only import `toast`. Styled with the app's theme tokens, so toasts
follow light and dark mode. Any other svelte-sonner Toaster prop passes
through.

**Import:** `$components/feedback/toaster/Toaster.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `import("/Users/joeldesante/Development/deice/node_modules/svelte-sonner/dist/...` | `'bottom-right'` | Where the stack of toasts sits on screen. |
| `duration` | `number | undefined` | `6000` | How long a toast stays up, in milliseconds. |

---

## Tooltip

**Import:** `$components/feedback/tooltip/Tooltip.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string | undefined` | — |  |
| `side` | `"top" | "bottom" | "left" | "right" | undefined` | `'bottom'` |  |
| `delayDuration` | `number | undefined` | `300` |  |
| `triggerClass` | `string | undefined` | `''` |  |
| `children` | `Snippet<[]>` | **required** |  |
| `content` | `Snippet<[]> | undefined` | — |  |

---
