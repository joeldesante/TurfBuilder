# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing Style

- Do not use emojis anywhere in documentation, markdown files, or code comments.

## Commands

```bash
# Development
npm run dev              # SvelteKit dev server (Vite)
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # All tests (unit + e2e)
npm run test:unit        # Vitest (unit + component tests)
npm run test:watch       # Vitest interactive watch mode
npm run test:ui          # Vitest browser UI
npm run test:e2e         # Playwright e2e tests

# Run a single test file
npx vitest run src/path/to/Component.svelte.spec.ts

# Linting & type checking
npm run lint             # ESLint
npm run format           # Prettier
npm run check            # svelte-check (type checking)

# Storybook
npm run storybook        # Storybook dev server
```

## Tech Stack

- **Framework:** SvelteKit 5 with Svelte 5 runes, TypeScript strict mode
- **Database:** PostgreSQL + PostGIS (geospatial), accessed via `pg` driver
- **Auth:** better-auth (sessions, org membership) + custom RBAC + PostgreSQL RLS
- **Migrations:** idempotent SQL in `src/lib/server/setup-schema.ts` (run via `/setup` or `/infra/migrate`)
- **Maps:** MapLibre GL + @geoman-io/maplibre-geoman-free
- **Styling:** Tailwind CSS 4
- **UI primitives:** Bits UI + Phosphor Svelte icons
- **Tables:** @tanstack/table-core
- **Validation:** Zod + zod-empty
- **Toasts:** svelte-sonner, through the `Toaster` component in the root layout
- **Object storage:** DigitalOcean Spaces (S3 API) via `@aws-sdk/client-s3`, for location photos and generated PDFs
- **PDF generation:** Puppeteer (headless Chromium) + Handlebars templates; MapLibre renders static maps in the same browser
- **Observability:** OpenTelemetry → Jaeger

## Environment Variables

Required in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string. Default points to the Docker Compose container. |
| `BETTER_AUTH_SECRET` | Secret key for encrypting session cookies and sensitive auth data. Changing it invalidates all active sessions. Generate a new value for any non-local environment. |

Optional:

| Variable | Description |
|----------|-------------|
| `SPACES_ACCESS_KEY_ID` / `SPACES_SECRET_ACCESS_KEY` | Object storage credentials. Endpoint, region, and bucket are system settings (`spaces.*`), never env vars. Without them, photo uploads and PDF generation report that storage is not set up. |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium binary for Puppeteer. The Docker images set it to Alpine's `/usr/bin/chromium-browser` (Puppeteer's bundled Chrome is glibc-only); outside Docker, leave it unset and Puppeteer uses its own download. |

## Architecture Overview

This is a multi-tenant canvassing platform. All data is scoped to an `organization_id`. Two separate user audiences share the same codebase:

- **Volunteers** access `/o/[org_slug]/` — map view, survey submission
- **Staff (organizers)** access `/o/[org_slug]/s/` — manage turfs, surveys, responses, users, settings
- **Plugins** extend both surfaces at `/o/[org_slug]/s/plugins/[slug]/` and `/o/[org_slug]/plugins/[slug]/`

### Request lifecycle

1. `src/hooks.server.ts` resolves `locals.user` (from better-auth session) and `locals.organization` (org membership + resolved RBAC permissions) on every request
2. `/o/[org_slug]/+layout.server.ts` guards require `locals.user` + `locals.organization`
3. `/o/[org_slug]/s/+layout.server.ts` additionally requires `locals.organization.role` (staff), loads `activePlugins`
4. Route `+page.server.ts` / API handlers run queries inside `withOrgTransaction`, which sets PostgreSQL `app.current_org_id` for RLS
5. Route `+page.svelte` files are thin shells — all UI lives in `$pages` story components

### Database schemas

- `auth.*` — managed by better-auth: `user`, `session`, `account`, `organization`, `member`, `invitation`
- `public.*` — app tables: `turf`, `survey`, `response`, `location`, `plugin_installation`, `permission_role`, `permission_role_entry`
- `universe.*` — entities, locations, buckets, lists, turfs, and `list_document` (generated list PDFs). Universe tables name the org column `org_id`, not `organization_id`

### RBAC model

Permissions are resolved at request time by `resolveOrgPermissions()` and stored in `locals.organization.permissions`. A user can have permissions granted directly or via named roles. Owners (`org.role.is_owner === true`) bypass all checks. Always use `can()` — never raw table checks.

---

## Pages and Components

All pages and components must be defined in the `/stories` directory and they must be valid storybook stories. These components and pages can then be referenced in the application itself later.

All new components must have tests associated with them.

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

### Toasts

Show transient messages (errors, confirmations) with `toast` from `svelte-sonner`; the `Toaster` in `src/routes/+layout.svelte` displays them, so pages never mount their own.

```ts
import { toast } from 'svelte-sonner';
toast.error('The PDF could not be generated.');
```

- Messages must be safe to show a user: never pass a raw exception or server error through. Write the message, or use one the server wrote for users (such as a list document's `error`)
- In component tests the root layout is absent: `render(Toaster)` alongside the component and assert with `page.getByText(...)` (toasts use `aria-live`, not `role="alert"`); call `toast.dismiss()` in `afterEach`

---

## Route Architecture

- **Volunteer-facing:** `/o/[org_slug]/` — canvassers; map, survey submission
- **Staff-facing:** `/o/[org_slug]/s/` — organizers; turfs, surveys, data, users, settings
- **Plugin pages (staff):** `/o/[org_slug]/s/plugins/[plugin_slug]/[...path]`
- **Plugin pages (volunteer):** `/o/[org_slug]/plugins/[plugin_slug]/[...path]`
- **Internal API:** `/o/[org_slug]/s/api/` — JSON endpoints consumed by fetch in route files
- **Versioned API:** `/api/v1/organizations/[org_id]/...` — addressed by org id, outside `/o/[org_slug]`, so hooks do not resolve `locals.organization` and no layout guard runs. Each handler checks access itself (see `$lib/server/list-access.ts`). Currently: list documents
- **Global utilities:** `/join` (turf code entry), `/orgs` (org picker), `/orgs/create`, `/invite/[token]`
- **Infrastructure:** `/infra/` — system dashboard, users, settings, migrations (requires infra permissions)
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

Use `can()` from `$lib/auth-helpers` for all permission checks.

```ts
import { can } from '$lib/auth-helpers';
if (!can(locals.organization, 'survey', 'create')) throw error(403, 'Forbidden');
```

- Owners (`org.role.is_owner === true`) bypass all permission checks
- Staff guard (any role = staff access): check `locals.organization?.role` exists
- Permission keys use dot notation: `resource.action`
- Outside `/o/[org_slug]` (the `/api/v1/organizations/[org_id]` routes) `locals.organization` is not set, so `can()` has nothing to read. Use `canOrg(client, userId, orgId, key)` from `$lib/server/permissions` inside `withOrgTransaction`, as `requireListAccess()` does

### Organization permission keys

| Key | Description |
|-----|-------------|
| `system.access` | Access the staff dashboard (`/s/`) |
| `canvass.use` | Canvass in the field |
| `turf.read/create/update/delete` | Manage turfs |
| `location.read/create/update/delete` | Manage org-private locations |
| `survey.read/create/update/delete` | Manage surveys |
| `response.read/delete` | View and delete canvassing responses |
| `member.read/invite/update/delete` | Manage org members and invite links |
| `role.read/create/update/delete` | Manage permission roles |
| `plugin.manage` | Install and configure plugins |

### Infrastructure permissions

Resolved by `resolveInfraPermissions()` from `$lib/server/permissions`. Required for all `/infra/` routes.

| Key | Description |
|-----|-------------|
| `access` | Access the infra dashboard |
| `users.manage` | Manage all users |
| `settings.manage` | Manage system settings and run migrations |
| `locations.overture_sync` | Run Overture data sync |

---

## Schema Management

Database schema is managed via `src/lib/server/setup-schema.ts` as idempotent SQL statements. Do not add migration files — update `setup-schema.ts` instead.

- **First install:** visit `/setup` to initialize the database and create the admin user
- **Updates (existing DB):** visit `/infra/migrate` — reruns all schema steps safely; existing data is never modified
- If `/setup` is needed on an existing DB (e.g. broken settings), it stays accessible as long as `system_setting` is missing or unpopulated — hooks redirect to `/setup` instead of 500ing

### System Settings

Runtime configuration is stored in the `system_setting` table and managed at `/infra/settings`.

| Key | Description |
|-----|-------------|
| `base_url` | Public URL of the instance. Used for auth callbacks. |
| `application_name` | Display name shown in the UI and page title. |
| `html.header_content` | Raw HTML injected into `<head>` on every page (e.g. analytics scripts). |
| `spaces.endpoint` | Object storage endpoint, e.g. `https://nyc3.digitaloceanspaces.com`. |
| `spaces.region` | Object storage region, e.g. `nyc3`. Empty means `us-east-1`. |
| `spaces.bucket` | Bucket for location photos and generated PDFs. |

**Important:** `base_url` is read at auth instance startup. After saving a new value, restart the pods for it to take effect:
```bash
kubectl rollout restart deployment/turfbuilder-production -n turfbuilder
```

---

## List Documents (PDFs)

Staff generate a printable PDF of a location list (master list, turf checkout sheet, one page per turf with numbered maps) from the list page. Full guide: `docs/guides/list-documents.md`; API: `docs/api/documents.md`.

- **Flow:** `POST /api/v1/organizations/[org_id]/lists/[list_id]/documents` inserts a `pending` row in `universe.list_document`, soft-deletes the list's earlier documents (`deleted_at`, `superseded_by`), and starts `generateListDocument()` in the background (not awaited). The client (`$lib/client/list-document.ts`) polls `GET .../documents/[id]` and follows the presigned download link. `DELETE .../documents/[id]` soft-deletes.
- **Rendering:** `list-document.service.ts` loads data (every query filtered by `org_id`), draws all maps with one `openMapRenderer()` browser, fills the Handlebars template, prints with `generatePDF()`, uploads with `uploadObject()`. At most two Chromes per document.
- **Failure:** generation fails after `GENERATION_TIMEOUT_MS` (90s, under the client's 2 minute wait). On failure the documents it superseded are restored. Only `ListDocumentError` messages (and a storage-not-configured message) are stored in `error` and shown; everything else becomes a generic message and the real error is logged.
- **Template:** `src/lib/server/services/templates/list-document.html`, imported with `?raw`. Rules: inline styles only (no `<style>`, no `@page`); the outer layout table provides page margins; each turf is `<section style="break-before: page;">` with its heading in a repeating `<thead>`; the footer logo must be an `<img>` with a `data:` URI (inline `<svg>` in a fixed footer prints on page 1 only); no network resources; escaped `{{...}}` only; notes as Handlebars comments (`{{!-- --}}`), never HTML comments. Style: readability first (near-black, 8.5pt minimum, serif tables), then minimal ink (no fills, black and gray); no small all-caps labels.
- **Storage key:** `orgs/{org_id}/lists/{list_id}/documents/{document_id}.pdf` (from `listDocumentKey()`). Files are never hard-deleted by the app (retention: #174).
- **Chromium:** Docker images install Alpine `chromium` + `mesa-egl` + fonts. Containers run as root, so Chrome runs with `--no-sandbox` (moving to a worker: #181). Map tiles come from `tiles.openfreemap.org` at render time.

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

### E2E tests

- `npm run test:e2e` rebuilds the stack from `docker-compose.test.yml` from scratch (Postgres, the dev frontend, NATS, and an `adobe/s3mock` stand-in for Spaces), so stop the dev stack first: both use ports 5173 and 5432
- Projects in `playwright.config.ts`: `setup` runs first; `schema`, `auth`, and `list-documents` depend on it
- `e2e/helpers.ts`: `gotoHydrated()` waits for `document.body.dataset.hydrated`; `signInAsAdmin()` signs in as the account setup creates (`test@example.com` / `Password123`)
- Staff pages require a verified email and tests cannot receive mail, so specs that visit `/o/[slug]/s/...` set `email_verified = true` for the user in the database first
- Tests talk to the database directly (`E2E_DATABASE_URL` in `.env.test`) to seed data and check results
- The schema spec fails any org-scoped table (`organization_id` or `org_id`) without forced row-level security and a policy, unless it is in the reviewed `RLS_EXEMPT` list
- `auth.spec.ts` › "signing in again is bypassed once a session exists" is a known failure (#179)

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
