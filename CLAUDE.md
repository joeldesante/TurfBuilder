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
    navigation/
  pages/            ← full page templates (imported by route +page.svelte files)
    auth/
    orgs/
    survey/
    system/         ← legacy name; prefer org/ for new org-scoped pages
```

Each component needs three files: `ComponentName.svelte`, `ComponentName.stories.svelte`, `ComponentName.svelte.spec.ts`.

### Path Aliases

Always use these aliases instead of relative paths when importing from stories:

| Alias | Resolves to |
|-------|-------------|
| `$components` | `src/stories/components` |
| `$pages` | `src/stories/pages` |
| `$config` | `src/config` |

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

---

## Route Architecture

- **Volunteer-facing:** `/o/[org_slug]/` — canvassers; map, survey submission
- **Staff-facing:** `/o/[org_slug]/s/` — organizers; turfs, surveys, data, users, settings
- **Global utilities:** `/join` (turf code entry), `/orgs` (org picker), `/orgs/create`
- `/auth/**` — managed by better-auth; do not modify

---

## Database Patterns

- Use `POOL` for all application queries
- Use `AUTH_POOL` only when querying `auth.*` tables directly (it sets `search_path=auth`)
- Always use parameterized queries — never string interpolation
- Every query touching `survey` or `turf` must include `AND organization_id = $N` using `locals.organization.id`
- Always call `client.release()` inside a `finally` block after `POOL.connect()`

```ts
const client = await POOL.connect();
try {
  const result = await client.query(`SELECT ... WHERE organization_id = $1`, [locals.organization!.id]);
} finally {
  client.release();
}
```

---

## Permissions

Use `can()` from `$lib/auth-helpers` for all permission checks. Do not use `hasSystemAccess()` for new code.

```ts
import { can } from '$lib/auth-helpers';
if (!can(locals.organization, 'survey', 'create')) throw error(403, 'Forbidden');
```

- Owners (`org.role.is_owner === true`) bypass all permission checks
- Resources: `survey`, `turf`, `response`, `member`, `role`
- Actions: `create`, `read`, `update`, `delete`, `ban`
- Staff guard (any role = staff access): check `locals.organization?.role` exists

---

## Migrations

- Files live in `/migrations/` using TypeScript + `node-pg-migrate`
- Filename format: `<unix_ms_timestamp>_<kebab-description>.ts`
- Run: `npm run db` (dev) or `npm run db:prod`
- Every migration must export `up()` and `down()` functions

---

## Svelte 5 Runes

Use Svelte 5 runes syntax throughout — not Svelte 4 stores for local state.

```ts
const { foo, bar } = $props();        // props
let count = $state(0);                 // reactive state
let double = $derived(count * 2);     // derived value
$effect(() => { /* side effect */ }); // effects
```
