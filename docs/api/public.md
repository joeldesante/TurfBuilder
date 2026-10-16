# Public API

Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}`

One bucket.

**Auth:** Staff  

**Response**

The bucket, with `filters` null if it was made before the filter editor and its old filter could not be converted. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/buckets/{bucket_id}`

Replaces a bucket's name, slug, and filters. All three are required.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name of the bucket |
| `slug` | `string` |  | URL slug, unique within the organization |
| `filters` | `object` |  | What the bucket selects: `{ v: 2, people, locations }` |

**Response**

The bucket. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 for a taken slug

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/buckets/{bucket_id}`

Updates the given fields of a bucket and leaves the rest as they are.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Optional. Display name of the bucket |
| `slug` | `string` |  | Optional. URL slug, unique within the organization |
| `filters` | `object` |  | Optional. What the bucket selects: `{ v: 2, people, locations }` |

**Response**

The bucket. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 for a taken slug

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}/lists`

The lists in a bucket, newest first.

**Auth:** Staff  

**Response**

`Array<{ id, name, bucket, entity_type, expires_at, created_at }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/buckets/{bucket_id}/lists`

Creates a list: a snapshot of the records the bucket's filters match,
narrowed by the list's own filters. The list does not change afterwards.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name of the list |
| `entity_type` | `string` |  | `people` or `locations`; the bucket must include it |
| `expires_at` | `string` |  | ISO date-time when the list expires |
| `filters` | `object` |  | Optional. A filter group narrowing the bucket's records; leave out for all of them |

**Response**

201 with `{ id }`. 400 for an invalid id or body, a kind of record the bucket does not include, or a filter that cannot run; 401 when signed out; 403 without staff access; 404 when the bucket is not in the caller's organizations; 422 when the bucket's old filter cannot be converted; 501 for a filter that is not supported yet

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}/locations`

The locations a bucket's filter matches, one page at a time, ordered by name. An empty page when the bucket does not include locations.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ id, name, address_line_1, address_line_2, city, state_or_region, postal_code }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}/people`

The people a bucket's filter matches, one page at a time, ordered by last then first name. An empty page when the bucket does not include people.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ id, first_name, last_name, email, phone, dob }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}/surveys`

The surveys in a bucket, by name.

**Auth:** Staff  

**Response**

`Array<{ id, bucket_id, name, description }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/buckets/{bucket_id}/surveys`

Creates an empty survey in the bucket. Add questions with
`PUT /api/v1/surveys/{survey_id}/questions`.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name, 1 to 255 characters |
| `description` | `string|null` |  | Optional, at most 2000 characters |

**Response**

201 with the survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/lists/{list_id}/entries`

A list's entries as they were when the list was created, one page at a time. People are ordered by last then first name, locations by city then name.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ record_id, record_source, entity_id, first_name, last_name, email, phone } for a people list, { record_id, record_source, entity_id, name, address_line_1, city, state_or_region, postal_code } for a locations list>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the list is not in the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations`

Creates a new organization with the caller as its owner.

Goes through better-auth so the default roles are created too. Fails with 403 when
creation is disabled in system settings and 409 when the slug is taken.

**Auth:** user  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name of the organization |
| `slug` | `string` |  | URL slug, unique across organizations |

**Response**

201 `{ id, name, slug, created_at }`. 400 for an invalid body, 401 when signed out, 403 when creation is disabled, 409 for a taken slug

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}`

One organization.

**Auth:** user  

**Response**

`{ id, name, slug, created_at }`. 400 for an invalid id, 401 when signed out, 404 when the caller is not a member

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}`

Replaces an organization's name and slug. Both are required.

**Auth:** Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name of the organization |
| `slug` | `string` |  | URL slug, unique across organizations |

**Response**

The organization. 400 for an invalid id or body, 401 when signed out, 403 when the caller is not an owner, 404 when the caller is not a member, 409 for a taken slug

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/organizations/{organization_id}`

Updates the given fields of an organization and leaves the rest as they are.

**Auth:** Owner only  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Optional. Display name of the organization |
| `slug` | `string` |  | Optional. URL slug, unique across organizations |

**Response**

The organization. 400 for an invalid id or body, 401 when signed out, 403 when the caller is not an owner, 404 when the caller is not a member, 409 for a taken slug

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/buckets`

The organization's buckets, newest first.

**Auth:** Staff  

**Response**

`Array<{ id, org_id, name, slug, filters, created_at }>`. `filters` is null for a bucket made before the filter editor whose old filter could not be converted. 401 when signed out, 403 without staff access, 404 when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/buckets`

Creates a new bucket (a saved filter over the org's entities) in the
organization.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name of the bucket |
| `slug` | `string` |  | URL slug, unique within the organization |
| `filters` | `object` |  | What the bucket selects: `{ v: 2, people, locations }`, each a filter group or null for a kind of record the bucket does not include |

**Response**

201 with the bucket. 400 for an invalid body, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 409 for a taken slug

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/locations`

The organization's current locations, one page at a time, ordered by name.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ id, entity_id, name, address_line_1, address_line_2, city, state_or_region, postal_code, country_code, latitude, longitude, photo_keys, suggestion_status }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without `location.read`, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/members`

The organization's members, one page at a time, ordered by name, each with their highest-priority role.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ id, name, email, role_id, role_name }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without `member.read`, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/people`

The organization's current people, one page at a time, ordered by last then first name.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |

**Response**

`{ items: Array<{ id, first_name, last_name, email, phone, dob }>, totalCount, page, pageSize }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/surveys/{survey_id}`

One survey.

**Auth:** Staff  

**Response**

`{ id, bucket_id, name, description }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/surveys/{survey_id}`

Replaces a survey's name and description. The name is required; an omitted description is cleared.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name, 1 to 255 characters |
| `description` | `string|null` |  | Optional, at most 2000 characters |

**Response**

The survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/surveys/{survey_id}`

Updates the given fields of a survey and leaves the rest as they are.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Optional. Display name, 1 to 255 characters |
| `description` | `string|null` |  | Optional. Null clears it |

**Response**

The survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/surveys/{survey_id}`

Deletes a survey with its questions and all responses to them.

**Auth:** Staff  

**Response**

204 No Content. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 while a turf uses the survey

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/surveys/{survey_id}/questions`

The questions of a survey in display order.

**Auth:** Staff  

**Response**

`Array<{ id, survey_id, question_text, question_type, order_index, choices }>`. `question_type` is `text`, `radio`, or `check`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the survey is not in the caller's organizations

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/surveys/{survey_id}/questions`

Makes the survey's questions exactly the array sent, in that order. Entries
with an `id` update that question, entries without one create a question, and
questions left out are deleted along with their responses.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `The` | `any` |  | array of `{ id?, question_text, question_type, choices }`, where `question_type` is `text`, `radio`, or `check` |

**Response**

The questions as `GET` returns them. 400 for an invalid id or body, or an `id` that is not one of the survey's questions, 401 when signed out, 403 without staff access, 404 when the survey is not in the caller's organizations

---
