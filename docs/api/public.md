# Public API

Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/audit-events`

Every change infrastructure admins have made, newest first, 100 to a page.

**Auth:** infra audit.read  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorId` | `uuid` | Optional: the admin who made the change |
| `action` | `string` | Optional action key, such as `user.suspend` |
| `targetType` | `string` | Optional: user, organization, session, setting, email_template, infra_role, or system |
| `targetId` | `string` | Optional id of what was changed |
| `from` | `date` | Optional first day, YYYY-MM-DD |
| `to` | `date` | Optional last day, YYYY-MM-DD |
| `page` | `number` | Page number, from 1 |

**Response**

`Page<AuditEntry>`. 401 when signed out, 403 without audit.read. Malformed filters are ignored

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/email-logs`

Every email the app tried to send, newest first, 100 to a page.

**Auth:** infra settings.manage  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `status` | `string` | Optional: sent, skipped, or failed |
| `template` | `string` | Optional template key |
| `recipient` | `string` | Optional exact address |
| `page` | `number` | Page number, from 1 |

**Response**

`Page<EmailLogEntry>`. 401 when signed out, 403 without settings.manage

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/email-templates`

Every email template the app sends, without bodies.

**Auth:** infra settings.manage  

**Response**

`EmailTemplateSummary[]`. 401 when signed out, 403 without settings.manage

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/email-templates/{template_key}`

One email template with its subject, body, variables, and sample values.

**Auth:** infra settings.manage  

**Response**

`EmailTemplateDetail`. 400 for a malformed key, 403 without settings.manage, 404 for an unknown template

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/email-templates/{template_key}`

Replaces a template's subject and body.

**Auth:** infra settings.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `subject` | `string` |  | The subject line, with optional &#123;&#123;variables&#125;&#125; |
| `htmlBody` | `string` |  | The HTML body, with optional &#123;&#123;variables&#125;&#125; |

**Response**

the saved `EmailTemplateDetail`. 400 for an invalid body, 403 without settings.manage, 404 for an unknown template

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/email-templates/{template_key}/resets`

Puts the template back to the text the app shipped with.

**Auth:** infra settings.manage  

**Response**

the restored `EmailTemplateDetail`. 400 for a malformed key, 403 without settings.manage, 404 for an unknown template or one with no default

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/email-templates/{template_key}/test-sends`

Emails the template, filled with sample values, to the signed-in admin. Unsaved text can be sent by passing it.

**Auth:** infra settings.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `subject` | `string` |  | Optional subject to send instead of the saved one |
| `htmlBody` | `string` |  | Optional body to send instead of the saved one |

**Response**

`{ to }`. 400 for an invalid body, 403 without settings.manage, 404 for an unknown template, 409 when mail is not set up, 502 when the mail server refuses it

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/impersonations/current`

Ends the current impersonation and restores the admin's own session.

**Auth:** the impersonating session  

**Response**

`{ userId }` of the user who was impersonated. 401 when signed out, 409 when not impersonating

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/infra-roles`

Every infrastructure role, with the permissions it grants and how many hold it.

**Auth:** infra users.manage  

**Response**

`InfraRole[]`. 401 when signed out, 403 without users.manage

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/invitations/{invitation_id}`

Cancels a pending email invitation.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 when there is no pending invitation with that id

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/invite-links/{invite_link_id}`

Closes an invite link so it can no longer be used to join.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 when there is no open link with that id

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/mail-tests`

Sends a short test email to the signed-in admin, to prove outgoing mail works.

**Auth:** infra settings.manage  

**Response**

`{ to }`. 403 without settings.manage, 409 when mail is not set up, 502 when the mail server refuses it

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/members/{member_id}`

Removes someone from their organization.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown member, 409 for the only owner

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/metrics/{metric}`

One platform metric over a time range, as chart data or CSV.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `range` | `string` | Optional. 7d, 30d, 90d, 1y, all, or any dashboard range. Default 30d |
| `granularity` | `'day'|'week'|'month'` | Optional. Coarsened for long ranges |
| `format` | `'json'|'csv'` | Optional. Default json |

**Response**

`{ window, metric }`, or a CSV file. 400 for an unknown metric, 401 when signed out, 403 without infra access

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/migrations`

Runs every schema step, then the data steps (legacy bucket filter conversion,
activity backfill, activity pruning), streaming progress as server-sent events.
Safe to rerun on an existing database.

**Auth:** infra settings.manage  

**Response**

`text/event-stream` of `{ step, total, label, status, error?, detail? }`, ending with `{ done: true }`. 401 when signed out, 403 without settings.manage

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations`

Every organization on the instance, one page at a time. Deleted ones only with `status=deleted`.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `q` | `string` | Optional. Matches name or slug |
| `status` | `'all'|'active'|'inactive'|'suspended'|'deleted'` | Optional. Active and inactive mean used, or not, in the last 90 days |
| `sort` | `'newest'|'oldest'|'members'|'recently_active'|'name'` | Optional. Default newest |
| `page` | `number` | Optional. 1-based page of 100 |

**Response**

`{ items: PlatformOrgRow[], totalCount, page, pageSize }`. 401 when signed out, 403 without infra access

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

`{ id, name, slug, created_at }`, plus `platform` (PlatformOrgDetail) for infra admins, who can read any organization. 400 for an invalid id, 401 when signed out, 404 when the caller is not a member

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

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{organization_id}`

Soft-deletes the organization. Members lose it; its data stays and an infra admin can restore it.

**Auth:** infra orgs.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `confirmSlug` | `string` |  | The organization's slug, typed to confirm |

**Response**

204. 400 when the slug does not match, 403 without orgs.manage, 404 for an unknown org, 409 when already deleted

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/activity-events`

What happened in the organization, newest first, 25 to a page.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based |

**Response**

`{ items: ActivityEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/audit-events`

Changes infra admins made to the organization, newest first, 25 to a page.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based |

**Response**

`{ items: AuditEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/invitations`

Pending email invitations and open invite links.

**Auth:** infra access  

**Response**

`{ invitations: OrgInvitation[], links: OrgInviteLink[] }`. 400 for an invalid id, 403 without infra access, 404 for an unknown org

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

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/ownership`

Makes a member the owner. They also get the Administrator role; previous owners become admins.

**Auth:** infra orgs.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `memberId` | `uuid` |  | The member to make owner |

**Response**

204. 400 for an invalid body, 403 without orgs.manage, 404 for an unknown org or member, 409 for a deleted org

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/restorations`

Restores a deleted organization.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown org, 409 when not deleted

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/suspension`

Suspends the organization: its members see a suspended page instead of it. Nothing is deleted.

**Auth:** infra orgs.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reason` | `string` |  | Why, for the audit log |

**Response**

204. 400 for an invalid body, 403 without orgs.manage, 404 for an unknown org, 409 when already suspended or deleted

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{organization_id}/suspension`

Lifts the suspension.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown org, 409 when not suspended

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/sessions/{session_id}`

Ends one session.

**Auth:** infra users.manage  

**Response**

204. 400 for an invalid id, 401 when signed out, 403 without users.manage, 404 for an unknown session

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/storage-tests`

Writes and deletes a small probe object, to prove the bucket works with the current settings.

**Auth:** infra settings.manage  

**Response**

204. 403 without settings.manage, 409 when storage is not set up, 502 when the bucket cannot be reached

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/system-health`

How the running instance is doing: Node and Postgres versions, database size and largest tables,
connection pool use, and whether migrations, mail, storage, and Chromium are set up.

**Auth:** infra access  

**Response**

`SystemHealth`. 401 when signed out, 403 without infra access

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/system-settings`

Every registered system setting with its stored value, or its default when it has never been saved.

**Auth:** infra settings.manage  

**Response**

`SystemSettingValue[]`. 401 when signed out, 403 without settings.manage

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/system-settings`

Saves any subset of settings. Each value is checked against its own definition, and nothing is saved if any is invalid.

**Auth:** infra settings.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `{object} - Setting keys mapped to their new text values` | `any` |  |  |

**Response**

`{ saved: string[], restartRequired: boolean }`. 400 with `errors` mapping each bad key to a message, 403 without settings.manage

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users`

Every user on the instance, one page at a time.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `q` | `string` | Optional. Matches name, email, or username |
| `status` | `'all'|'unverified'|'suspended'|'two_factor'|'infra_admin'|'no_orgs'|'never_active'` | Optional |
| `sort` | `'newest'|'oldest'|'recently_active'|'name'` | Optional. Default newest |
| `page` | `number` | Optional. 1-based page of 100 |

**Response**

`{ items: PlatformUserRow[], totalCount, page, pageSize }`. 401 when signed out, 403 without infra access

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}`

One user, with their sign-in methods, infra roles, and suspension.

**Auth:** infra access  

**Response**

`PlatformUserDetail`. 400 for an invalid id, 401 when signed out, 403 without infra access, 404 for an unknown user

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/users/{user_id}`

Edits the given fields. A new email is unverified unless `emailVerified` is sent too.

**Auth:** infra users.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Optional |
| `email` | `string` |  | Optional |
| `username` | `string` |  | Optional |
| `emailVerified` | `boolean` |  | Optional |

**Response**

`PlatformUserDetail`. 400 for an invalid body, 403 without users.manage, 404 for an unknown user, 409 for a taken email or username or a deleted account

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/users/{user_id}`

Deletes the account by anonymizing it: the user's records in orgs stay, their
name, email, and sign-in methods do not, and they leave every org.

**Auth:** infra users.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `confirmEmail` | `string` |  | The account's email, typed to confirm |

**Response**

204. 400 when the email does not match or for yourself, 403 without users.manage, 404 for an unknown user, 409 when they are an org's only owner or the last admin

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/activity-events`

What the user has done, newest first, 25 to a page.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based |

**Response**

`{ items: ActivityEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/audit-events`

Changes infra admins made to the user, newest first, 25 to a page.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based |

**Response**

`{ items: AuditEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/email-logs`

Emails sent to the user's current address, newest first, 25 to a page.

**Auth:** infra access  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based |

**Response**

`{ items: EmailLogEntry[], totalCount, page, pageSize }`. 400 for an invalid id, 403 without infra access, 404 for an unknown user

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/users/{user_id}/impersonations`

Signs the caller in as the user for an hour. The response sets the new
session cookie; the caller's own session is restored by
DELETE /api/v1/impersonations/current.

**Auth:** infra users.impersonate  

**Response**

`{ userId, expiresAt }`. 400 for an invalid id or yourself, 403 without users.impersonate or for an infra admin, 404 for an unknown user, 409 for a deleted account

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/infra-roles`

The user's infrastructure roles.

**Auth:** infra users.manage  

**Response**

`{ id, name }[]`. 400 for an invalid id, 403 without users.manage, 404 for an unknown user

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/users/{user_id}/infra-roles`

Gives the user an infrastructure role.

**Auth:** infra users.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `roleId` | `uuid` |  | An infrastructure role |

**Response**

204. 400 for an invalid body, 403 without users.manage, 404 for an unknown user or role

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/users/{user_id}/infra-roles/{role_id}`

Takes an infrastructure role away from the user.

**Auth:** infra users.manage  

**Response**

204. 400 for an invalid id, 403 without users.manage, 404 when the user does not have it, 409 when it would leave no admin who can manage users

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/memberships`

The organizations the user belongs to, with their role and last activity in each.

**Auth:** infra access  

**Response**

`UserMembership[]`. 400 for an invalid id, 401 when signed out, 403 without infra access

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/users/{user_id}/password-resets`

Emails the user a link to choose a new password.

**Auth:** infra users.manage  

**Response**

202. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when mail is not set up or the account was deleted

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/users/{user_id}/sessions`

The user's sessions that have not expired, newest first.

**Auth:** infra access  

**Response**

`UserSession[]`. 400 for an invalid id, 401 when signed out, 403 without infra access, 404 for an unknown user

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/users/{user_id}/sessions`

Signs the user out everywhere. Revoking your own sessions keeps the one making the request.

**Auth:** infra users.manage  

**Response**

`{ revoked: number }`. 403 without users.manage, 404 for an unknown user

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/users/{user_id}/suspension`

Suspends the user: they are signed out now and cannot sign in until it ends.

**Auth:** infra users.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reason` | `string` |  | Shown to the user when they try to sign in |
| `expiresAt` | `string|null` |  | Optional. ISO date-time it ends; none means until lifted |

**Response**

`PlatformUserDetail`. 400 for an invalid body or yourself, 403 without users.manage, 404 for an unknown user, 409 for an infra admin or a deleted account

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/users/{user_id}/suspension`

Lifts the suspension.

**Auth:** infra users.manage  

**Response**

`PlatformUserDetail`. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when not suspended

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/users/{user_id}/two-factor`

Turns two-factor sign-in off, for someone locked out of their authenticator.

**Auth:** infra users.manage  

**Response**

204. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when it is not on

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/users/{user_id}/verification-emails`

Emails the user a new link to verify their address.

**Auth:** infra users.manage  

**Response**

202. 400 for an invalid id, 403 without users.manage, 404 for an unknown user, 409 when already verified, mail is not set up, or the account was deleted

---
