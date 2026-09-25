# List PDFs

Staff can turn a location list into a printable PDF for a canvassing day. It has a master list of every location, a checkout sheet of the turfs cut from the list, and one page per turf with a numbered map. This guide covers how organizers use it, how generation works, how to run it in production, and how to change the template safely.

## Using it

On a location list's page (**Universe → Buckets → a bucket → a list**), the header has a PDF button next to **View Map**:

| The list has... | Button | What happens |
|---|---|---|
| No PDF yet | **Generate PDF** | Generates one (the button shows **Generating**), then downloads it. |
| A PDF | **Download PDF** | Downloads the existing PDF straight away. |
| A PDF, but it's out of date | **More PDF options → Regenerate PDF** | Generates a fresh PDF, replaces the old one, and downloads it. |

Regenerate after anything that changes what's printed, most often after cutting turfs. The PDF is a snapshot and doesn't update itself.

If something goes wrong, a toast in the corner says what happened. If regenerating fails, the previous PDF stays available.

People lists don't have a PDF.

### What's in the PDF

| Section | Contents | Who it's for |
|---|---|---|
| Header | List name and when the PDF was generated. A contents list if turfs are cut. | Everyone |
| Master list of all locations | Expiry date and time, a map of every location with numbered markers, and a table of every location (number, name, address). Marked as organizer reference only. | Organizers |
| Master list of turfs | One row per turf: code, number of locations, and a box to tick by hand when the turf is checked out. Only when turfs are cut. | Organizers |
| One page per turf | Turf code, location count, a map of the turf with numbered markers, and its locations. Only when turfs are cut. | Hand to the canvasser |

- **Page breaks:** each turf starts on a new page, and no other content shares a page with it. If a turf runs past one page, its heading and column headers repeat on every page, so a loose page still says which turf it belongs to.
- **Map numbers:** the numbers on a map match the # column of the table below it. A location without coordinates keeps its number in the table but has no marker.
- **Times** print in the timezone of the person who generated the PDF, with the zone's abbreviation (e.g. "11:59 PM EDT"). A per-organization timezone setting will replace this ([#183](https://github.com/joeldesante/TurfBuilder/issues/183)).

## How it works

```
Browser (list page)             Web server                            Object storage
───────────────────             ──────────                            ──────────────
click Generate / Download
  GET  .../documents  ────────► current documents
  (reuse a ready one, join a recent pending one, or:)
  POST .../documents  ────────► insert pending row, reserve key,
                                soft-delete older documents
                      ◄──────── 202 + Location
                                generateListDocument() in background:
                                  load list, entries, turfs (org-scoped)
                                  draw maps (one headless Chrome)
                                  fill template, print PDF (Chrome)
                                  upload ────────────────────────────► orgs/{org}/lists/{list}/documents/{id}.pdf
                                  mark ready / failed
  GET  .../documents/{id}  ───► status (poll every 1.5s, up to 2 min)
                      ◄──────── ready + presigned link (5 min)
  follow the link  ──────────────────────────────────────────────────► file downloads as "<List name>.pdf"
```

### The pieces

| File | Role |
|---|---|
| `src/stories/pages/o/s/universe/buckets/lists/ListDetailPage.svelte` | The button, its states, the Regenerate menu, and error toasts. |
| `src/lib/client/list-document.ts` | `downloadListDocument()` and `regenerateListDocument()`: request, poll, download. Turns every failure into a message fit to show. |
| `src/routes/api/v1/organizations/[org_id]/lists/[list_id]/documents/` | The API: list, create, fetch, soft-delete. See the [API reference](../api/documents.md). |
| `src/lib/server/list-access.ts` | Checks the caller is signed in and has `system.access` in the org, and that the list belongs to it. These routes sit outside `/o/[org_slug]`, so no layout guard runs. |
| `src/lib/server/services/list-document.service.ts` | Loads the data, numbers and formats it, draws the maps, renders, uploads, and records the outcome. |
| `src/lib/server/services/map-engine.service.ts` | `openMapRenderer()`: one headless Chrome running MapLibre that draws any number of static maps (JPEG, 1400x720) with numbered markers and a dashed turf boundary. |
| `src/lib/server/services/pdf-engine.service.ts` | `generatePDF()`: fills a Handlebars template and prints a Letter PDF with headless Chrome. |
| `src/lib/server/services/browser.ts` | Launches Puppeteer. Drops the Chrome sandbox only when running as root. |
| `src/lib/server/services/templates/list-document.html` | The template. |
| `src/lib/server/storage.ts` | `listDocumentKey()`, `uploadObject()`, `presignDocumentDownload()`. |
| `src/stories/components/feedback/toaster/Toaster.svelte` | The toast area in the root layout; pages call `toast.error()` from `svelte-sonner`. |

### Data the PDF uses

- **Master list:** the list's entries, joined to the location versions snapshotted when the list was created, ordered by city then name.
- **Turfs:** turfs cut from the list, ordered by code. Each turf's locations are the current versions, ordered by name, matching what the turf page shows.
- **Numbers** are each row's position in its own table, starting at 1. Each turf numbers from 1 again. Numbers aren't database ids.
- **Addresses** are "line 1, city, state postal code". Missing parts are skipped, and a location with no name prints as "Unnamed location".
- **Every query** filters by organization, as well as running under row-level security via `withOrgTransaction`.

## Document lifecycle

Each generated PDF is a row in `universe.list_document`.

| Status | Meaning |
|---|---|
| `pending` | Row created and generation running. The storage key is reserved but the file may not exist yet. |
| `ready` | The file is uploaded and can be downloaded. |
| `failed` | Generation failed. `error` holds a message safe to show the user. |

- **One current document per list.** `POST` soft-deletes the list's earlier documents (`deleted_at`, with `superseded_by` pointing at the new row) in the same transaction as the insert. Soft-deleted documents are hidden from every endpoint. Their files stay in storage until retention cleans them up ([#174](https://github.com/joeldesante/TurfBuilder/issues/174)).
- **A failed regeneration restores the previous PDF.** When a document fails, the documents it superseded have `deleted_at` cleared, unless the failed document was itself replaced meanwhile, so an old PDF can't come back over a newer one.
- **Deleting.** `DELETE .../documents/{id}` soft-deletes a document; the list then shows **Generate PDF** again. There's no button for this in the app yet.
- **Timeouts.** Generation fails after 90 seconds (`GENERATION_TIMEOUT_MS`). This stops both Chromes and uploads nothing. The page stops waiting after 2 minutes, so it always sees the failure first. A `pending` document older than 5 minutes (left behind by a server restart mid-render) is ignored and a new one is started.
- **Error messages.** Only failures written for users are stored and shown:
  - list gone;
  - people list;
  - timed out;
  - storage not set up.

  Everything else is recorded as a generic "The PDF could not be generated..." message, and the real error goes to the server log (`List document <id> failed`). The browser helper also swaps network failures and 5xx responses for generic messages.

## Setup and operations

### Object storage

PDFs are stored in the same bucket as location photos, under `orgs/{org_id}/lists/{list_id}/documents/{document_id}.pdf`.

| Where | Setting |
|---|---|
| Environment | `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY` |
| `/infra/settings` | `spaces.endpoint`, `spaces.region` (defaults to `us-east-1` when empty), `spaces.bucket` |

Without storage configured, generation fails with "PDF storage has not been set up yet". Downloads use presigned GET links that expire after 5 minutes and are served as attachments.

### Chromium

Generation runs headless Chrome through Puppeteer, inside the web server process.

- **Docker images:** the `development` and `production` stages install Alpine's `chromium` along with:
  - `mesa-egl`, for software WebGL for the map renderer;
  - fonts (`font-noto`, `ttf-freefont`).

  They also set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` and `PUPPETEER_SKIP_DOWNLOAD=true`, because Puppeteer's bundled Chrome is glibc-only and doesn't run on Alpine.
- **Outside Docker:** `npm install` downloads Puppeteer's own Chrome, which renders maps with SwiftShader.
- **Sandbox:** the containers run as root, so Chrome runs without its sandbox. Moving rendering to a separate worker fixes this ([#181](https://github.com/joeldesante/TurfBuilder/issues/181)).
- **Load:** each document starts at most two Chromes, one for all the maps and one for the PDF. Nothing limits how many documents render at once ([#180](https://github.com/joeldesante/TurfBuilder/issues/180)).

### Network

Map rendering fetches the map style, tiles and fonts from `tiles.openfreemap.org` while it renders. If that service is slow or down, maps time out and the document fails ([#181](https://github.com/joeldesante/TurfBuilder/issues/181) makes maps optional). The PDF page itself loads nothing over the network.

### Migrations

The `universe.list_document` table, including `deleted_at` and `superseded_by`, and the `spaces.*` settings come from `setup-schema.ts`. Run `/infra/migrate` on existing databases.

## Editing the template

The template is `src/lib/server/services/templates/list-document.html`. `list-document.service.ts` imports it as a string with Vite's `?raw`, and it will move into the database later ([#173](https://github.com/joeldesante/TurfBuilder/issues/173)). The comment at the top documents the data it receives.

Chrome's print engine and the plan to store the template as a single string lead to a few firm rules:

::: v-pre
- **Inline styles only.** There's no `<style>` block and no `@page`. Page margins come from the outer layout table: Chrome repeats `<thead>` and `<tfoot>` on every printed page, and their spacer rows act as the top and bottom margins.
- **Leave the page-break structure alone:**
  - Each turf is a `<section style="break-before: page;">`.
  - The turf heading sits in its table's `<thead>`, which is why it repeats on overflow pages.
  - `break-before: right` doesn't work in Chrome, since it never inserts the blank page, so the PDF isn't safe for double-sided printing.
- **The footer logo must be an `<img>` with a `data:` URI.** An inline `<svg>` inside the `position: fixed` footer only prints on the first page.
- **Nothing loads over the network.** Images, including maps, are `data:` URIs passed in the data.
- **Data is always escaped:** use `{{value}}`, never `{{{value}}}`. The page renders in server-side Chrome, so user data must never become markup.
- **Comments are Handlebars comments** (`{{!-- ... --}}`), which rendering strips. HTML comments would be sent into every generated page.
- **Style:**
  - Readability first: near-black text, nothing smaller than 8.5pt, and a serif face for tables and lists.
  - Then ink: black and gray only, no filled areas, thin rules, because these are printed in bulk.
  - No small all-caps letter-spaced labels. Keep headings plain.
:::

`src/lib/server/services/templates/list-document.spec.ts` checks the template by compiling it with Handlebars. It covers the section rules, page breaks, the repeating turf heading, escaping, the logo, and no network resources or comments. Add a case there when you change the structure.

## API

See the [List Documents API reference](../api/documents.md). In short:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/organizations/{org_id}/lists/{list_id}/documents` | Current documents, newest first |
| `POST` | `/api/v1/organizations/{org_id}/lists/{list_id}/documents` | Start generating (optional `{ "timeZone": "America/New_York" }`). 202 + `Location` |
| `GET` | `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}` | Status, and a download link when ready |
| `DELETE` | `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}` | Soft-delete. 204 |

All four require a signed-in user with `system.access` in the organization.

## Database

`universe.list_document`, protected by row-level security (`org_isolation`, forced):

| Column | Notes |
|---|---|
| `id` | UUID, chosen by the server before insert so the storage key can include it. |
| `org_id`, `list_id` | Owning organization and list. Cascade on delete. |
| `storage_key` | Unique. Reserved at creation. |
| `status` | `pending`, `ready` or `failed`. |
| `error` | User-safe failure message. |
| `requested_by` | The user who asked. `SET NULL` if the user is deleted. |
| `created_at`, `completed_at` | When requested and when it finished. |
| `deleted_at` | Set when soft-deleted: replaced, or deleted through the API. |
| `superseded_by` | The document that replaced this one, used to restore it if that one fails. |

## Tests

| Where | Covers |
|---|---|
| `src/lib/server/services/*.spec.ts` | Service (data, numbering, maps, timezone, timeout, restore, safe errors), PDF engine, map engine, browser launch |
| `src/lib/server/services/templates/list-document.spec.ts` | Template structure and safety rules |
| `src/lib/client/list-document.spec.ts` | Reuse, join and create, polling, timeout, safe error messages, timezone in the request |
| `src/routes/api/v1/.../documents/**/server.spec.ts` | All four endpoints: access, validation, soft-delete and supersede queries |
| `src/routes/o/.../lists/[id]/page.server.spec.ts` | `hasPdf` on the list page |
| `ListDetailPage.svelte.spec.ts`, `Toaster.svelte.spec.ts` | Button states, the Regenerate menu, toasts |
| `e2e/list-documents.spec.ts` | Signed-out access is refused. The full flow on a real stack: generate, download, regenerate after cutting a turf, delete. |

The e2e stack (`docker-compose.test.yml`) includes an `adobe/s3mock` service standing in for Spaces. The test points the browser's `s3` hostname at the published port (`--host-resolver-rules`), so presigned links work from outside Docker. It also marks the setup admin's email as verified, because staff pages require it. Seeded locations have no coordinates, so e2e runs never fetch map tiles.

## Follow-ups

| Issue | Topic |
|---|---|
| [#173](https://github.com/joeldesante/TurfBuilder/issues/173) | Store the template in the database, viewable and editable in the UI |
| [#174](https://github.com/joeldesante/TurfBuilder/issues/174) | Retention for object storage, including superseded and deleted PDFs |
| [#180](https://github.com/joeldesante/TurfBuilder/issues/180) | Queue generation through NATS so render load is bounded across pods |
| [#181](https://github.com/joeldesante/TurfBuilder/issues/181) | Move rendering to a serverless worker; optional maps, sandboxed Chrome, style caching |
| [#182](https://github.com/joeldesante/TurfBuilder/issues/182) | Single downloadable executable (runs the worker as a daemon) |
| [#183](https://github.com/joeldesante/TurfBuilder/issues/183) | Per-organization timezone with an infrastructure default |
| [#184](https://github.com/joeldesante/TurfBuilder/issues/184) | Two people generating the same list's PDF at once |
| [#185](https://github.com/joeldesante/TurfBuilder/issues/185) | QR codes on the turf pages and checkout list |
| [#186](https://github.com/joeldesante/TurfBuilder/issues/186) | Non-ASCII characters in download filenames |
