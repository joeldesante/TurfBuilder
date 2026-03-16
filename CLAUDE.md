# CLAUDE INSTRUCTIONS

## Pages and Components

All pages and components must be defined in the `/stories` directory and they must be valid storybook stories. These components and pages can then be referenced in the application itself later. This is for organizational purposes.

All new components must have tests associated with them. Make sure tests are always up to date and maximize coverage.

### Stories Directory Layout

```
src/stories/
  components/       ← reusable UI primitives
    actions/
    data-display/
    data-inputs/
    feedback/
    layout/
  pages/            ← full page templates (imported by route +page.svelte files)
    auth/
    invite/
    join/
    orgs/
    settings/
    survey/
    system/         ← legacy namespace; prefer descriptive names for new pages
```

Each component needs three files: `ComponentName.svelte`, `ComponentName.stories.svelte`, `ComponentName.svelte.spec.ts`.

### Path Aliases

Always use these aliases instead of relative paths:

| Alias | Resolves to |
|-------|-------------|
| `$components` | `src/stories/components` |
| `$pages` | `src/stories/pages` |
| `$config` | `src/config` |
| `$plugins` | `src/plugins` |

### Route File Convention

Route files (`+page.svelte`, `+layout.svelte`) must be thin shells — they import and render a page component from `$pages`, passing server data as props. All UI and logic belongs in the stories page component.

**Correct pattern:**
```svelte
<!-- src/routes/some/route/+page.svelte -->
<script lang="ts">
  import MyPage from '$pages/some/MyPage.svelte';
  const { data } = $props();
</script>
<MyPage {...data} />
```

Route files may define async event handlers (e.g. fetch calls + `invalidateAll()`) and pass them as callback props to the page component. This is the preferred pattern over SvelteKit form actions.

Use `+page@.svelte` to break out of a parent layout (e.g. full-screen map pages that should not render the staff sidebar).

---

## Route Architecture

- **Volunteer-facing:** `/o/[org_slug]/` — canvassers; map, survey submission
- **Staff-facing:** `/o/[org_slug]/s/` — organizers; turfs, surveys, data, users, settings
- **Plugin pages (staff):** `/o/[org_slug]/s/plugins/[plugin_slug]/[...path]`
- **Plugin pages (volunteer):** `/o/[org_slug]/plugins/[plugin_slug]/[...path]`
- **Internal API:** `/o/[org_slug]/s/api/` — JSON endpoints consumed by fetch in route files
- **Global utilities:** `/join` (turf code entry), `/orgs` (org picker), `/orgs/create`, `/invite/[token]`
- `/auth/**` — managed by better-auth; do not modify

### Layout Guards

**Org layout** (`/o/[org_slug]/+layout.server.ts`): requires `locals.user` and `locals.organization`.

**Staff layout** (`/o/[org_slug]/s/+layout.server.ts`): additionally requires `locals.organization.role` (403 if absent), loads `activePlugins`.

Standard guard pattern:
```ts
if (!locals.user) throw redirect(303, '/auth/signin');
if (!locals.organization) throw redirect(303, '/orgs');
if (!locals.organization.role) throw error(403, 'Forbidden');
```

---

## Database Patterns

### Preferred: `withOrgTransaction`

Use `withOrgTransaction` for all org-scoped queries. It begins a transaction, sets `app.current_org_id` for Row-Level Security, and handles commit/rollback automatically.

```ts
import { withOrgTransaction } from '$lib/server/database';

return withOrgTransaction(locals.organization!.id, async (client) => {
  const result = await client.query(
    `SELECT ... WHERE organization_id = $1`,
    [locals.organization!.id]
  );
  return { data: result.rows };
});
```

### When to use `POOL.connect()` directly

Only use `POOL.connect()` for queries that don't require RLS scoping (e.g. looking up an org by slug before `locals.organization` is set). Always release in a `finally` block.

```ts
const client = await POOL.connect();
try {
  const result = await client.query(`SELECT ... WHERE organization_id = $1`, [locals.organization!.id]);
} finally {
  client.release();
}
```

### Rules

- Use `POOL` for all application queries
- Use `AUTH_POOL` only when querying `auth.*` tables directly (it sets `search_path=auth`)
- Always use parameterized queries — never string interpolation
- Every query touching `survey`, `turf`, or any org-scoped table must include `AND organization_id = $N`
- Defense in depth: both the application-layer `organization_id` filter AND PostgreSQL RLS via `app.current_org_id` are required

---

## Permissions

Use `can()` from `$lib/auth-helpers` for all permission checks. Do not use `hasSystemAccess()` for new code.

```ts
import { can } from '$lib/auth-helpers';
if (!can(locals.organization, 'survey', 'create')) throw error(403, 'Forbidden');
```

- Owners (`org.role.is_owner === true`) bypass all permission checks
- Resources: `canvass`, `turf`, `survey`, `response`, `member`, `plugin`
- Actions: `use`, `create`, `read`, `update`, `delete`
- Staff guard (any role = staff access): check `locals.organization?.role` exists

---

## Migrations

- Files live in `/migrations/` using TypeScript + `node-pg-migrate`
- Filename format: `<unix_ms_timestamp>_<kebab-description>.ts`
- Run: `npm run db` (dev) or `npm run db:prod`
- Every migration must export `up(pgm)` and `down(pgm)` functions

---

## Plugin System

Plugins extend the platform with org-specific features. They are defined in `src/plugins/` and installed per-org via the `plugin_installation` table.

### Defining a plugin

Create `src/plugins/<slug>/index.ts` exporting a `PluginManifest`:

```ts
import type { PluginManifest } from '$plugins/types';

export const manifest: PluginManifest = {
  slug: 'my-plugin',
  name: 'My Plugin',
  description: '...',
  version: '1.0.0',
  navEntries: (orgSlug) => [{ label: 'My Plugin', href: `/o/${orgSlug}/s/plugins/my-plugin` }],
  pages: { index: StaffPage },        // staff-facing pages keyed by path segment
  volunteerPages: { index: VolPage }, // volunteer-facing pages
  serverLoad: async (path, event) => ({ ... }),
  apiHandlers: { 'GET:status': async (ctx) => ({ ... }) },
  hooks: {
    onTurfCreated: async (ctx, turf) => { ... },
    onSurveySubmitted: async (ctx, response) => { ... },
  },
};
```

Register the plugin in `src/plugins/registry.ts`.

### Plugin context

`PluginContext` provides `db` (wraps `withOrgTransaction`), `orgId`, `userId`, `userRole`, and `config`.

### Firing hooks

```ts
import { fireHook } from '$lib/server/hooks';
await fireHook('onTurfCreated', locals.organization!.id, locals.user!.id, locals.organization!.role, turf);
```

`fireHook` uses `Promise.allSettled` — plugin failures do not crash the request.

---

## Testing

### Test file placement

- Component tests: `src/stories/**/*.svelte.spec.ts` — run in a real Chromium browser via Playwright
- Server/logic tests: `src/**/*.spec.ts` (excluding `*.svelte.spec.ts`) — run in Node

### Component test pattern

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import MyComponent from './MyComponent.svelte';

test('renders label', async () => {
  const { getByRole } = render(MyComponent, { props: { label: 'Hello' } });
  await expect.element(getByRole('button', { name: 'Hello' })).toBeVisible();
});
```

- Query priority: `getByRole` > `getByLabelText` > `getByPlaceholder` > `getByText` > `querySelector`
- All assertions must be `await expect.element(...)` (browser assertions are async)
- For context testing use `{ props, context }` form of `render()`
- `expect.requireAssertions: true` is enforced globally — every test must call `expect()`
- Test utilities and fixture components live in `src/stories/components/__tests__/`

---

## Svelte 5 Runes

Use Svelte 5 runes syntax throughout — not Svelte 4 stores for local state.

```ts
const { foo, bar } = $props();        // props
let count = $state(0);                 // reactive state
let double = $derived(count * 2);     // derived value
$effect(() => { /* side effect */ }); // effects
```

---

## Forms

Use the `Form` class from `$lib/client/formstorm/form.svelte.ts` for Zod-backed form state.

```ts
import { Form } from '$lib/client/formstorm/form.svelte.ts';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1) });
const form = new Form(schema);

// Reactive getters: form.values, form.errors, form.dirty, form.submitting, form.valid, form.errorMessage
```

`Form` initializes values from the Zod schema via `zod-empty` and validates on submit.
