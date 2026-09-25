# List Documents

Staff endpoints for generating, polling, downloading, and deleting the printable PDF of a location list.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents`

The list's current documents (generated PDFs), newest first. Replaced and
deleted documents are not included, so this is normally at most one, plus a
failed attempt when a regeneration failed and the previous PDF was restored.
No download links here; fetch a document by id for that.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`Array<{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at }>`, at most 20

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents`

Starts generating a printable PDF of the list: a master list of every
location, the turf checkout list, and one page per cut turf, with numbered
maps. The new document replaces the list's earlier ones (they are
soft-deleted) and they are restored if generation fails. Responds 202 as
soon as the row exists; poll the `Location` URL until the status is `ready`
or `failed`. Generation fails after 90 seconds. Only location lists can be
generated; a people list fails with a message saying so.

**Auth:** Staff  
**Permission:** `system.access`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `timeZone` | `string` |  | IANA timezone to print times in, e.g. `America/New_York`. Defaults to the server's zone. Temporary until organizations have a timezone setting (#183) |

**Response**

202 `{ id, list_id, status: 'pending', created_at }` with a `Location` header pointing at the document. 400 for an unknown timezone

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}`

A document's status, plus a download link once it is ready. This is the URL
POST .../documents hands back in Location; poll it until the status is no
longer `pending`. The link is a presigned object-storage URL that expires
after 5 minutes and downloads the file as an attachment named after the
list. Soft-deleted documents return 404.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at, download_url: string | null }`. `error` is a message safe to show users; `download_url` is set only when `status` is `ready`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{org_id}/lists/{list_id}/documents/{document_id}`

Soft-deletes a document, so the list has no current PDF until one is
generated again. The file stays in object storage; retention cleans it up
later (#174). Deleting a document that is still generating lets the render
finish but keeps its result hidden.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

204 No Content. 404 if the document is not on this list or is already deleted

---
