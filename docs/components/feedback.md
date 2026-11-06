# Feedback Components

## BetaBanner

**Import:** `$components/feedback/beta-banner/BetaBanner.svelte`

---

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

## ImpersonationBanner

**Import:** `$components/feedback/impersonation-banner/ImpersonationBanner.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userName` | `string` | **required** | The user being impersonated. |
| `onstop` | `() => Promise<void>` | **required** | Ends the impersonation; rejects with a message safe to show. |

---

## Loading

**Import:** `$components/feedback/loading/Loading.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `string | number | undefined` | `160` |  |
| `color` | `string | undefined` | `'var(--primary)'` |  |
| `label` | `string | undefined` | `'Loading'` |  |
| `reducedMotion` | `boolean | undefined` | — | Replaces the distortion and the sweeping wave with a light opacity pulse.
Left unset it follows the operating system's reduced motion setting; true or false forces it. |

---

## PageLoader

**Import:** `$components/feedback/page-loader/PageLoader.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | **required** | Whether the loader covers the screen. It fades in when it turns on and out when it turns off. |
| `width` | `string | number | undefined` | `'clamp(120px, 45vw, 180px)'` |  |
| `logoDelayMs` | `number | undefined` | `0` | How long the cover is up before the logo fades in on top of it. Until then it is only a
plain fade, so a quick load is a soft dip instead of a flash of logo. 0 shows the logo
straight away. |
| `logoMinMs` | `number | undefined` | `0` | Once the logo has started to appear, the least time it stays on screen. If `visible` turns
off sooner, the cover waits out the rest before it fades, so the logo never just blinks.
Does not apply when the logo never appeared. 0 turns it off. |
| `slowMessageDelayMs` | `number | undefined` | `0` | After the cover has been up this long, a short message fades in under the logo saying the
server is slow. 0 means never. |
| `slowMessage` | `string | undefined` | `'This is taking a little longer than usual.\nThanks for your patience.'` | Shown under the logo. A line break (\n) starts a new line. |

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
| `position` | `import("/Volumes/Storage/Development/TurfBuilder/node_modules/svelte-sonner/d...` | `'bottom-right'` | Where the stack of toasts sits on screen. |
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
