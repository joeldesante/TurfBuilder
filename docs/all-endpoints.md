# All Endpoints

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/buckets/{bucket_id}/scripts`

The scripts in a bucket, most recently changed first, without their text.

**Auth:** Staff  

**Response**

`Array<{ id, bucket_id, name, updated_at }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/buckets/{bucket_id}/scripts`

Creates a script in the bucket.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name, 1 to 255 characters |
| `contents` | `string` |  | Optional. The script text; empty when omitted |

**Response**

201 with `{ id, bucket_id, name, updated_at, contents }`. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the bucket is not in the caller's organizations

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/doors/{door_id}/edits`

Proposes a correction to a door whose record is wrong. Staff review it
before it changes the location; photos travel with it as evidence.

**Auth:** turf member, while the turf is open  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Any` | `any` |  | subset of the location fields, plus `note` &#123;string&#125;; latitude and longitude together or not at all |

**Response**

201 with `{ id }`. 400 for an invalid id, an invalid body, or one with nothing in it, 401 when signed out, 403 when the turf is closed or the caller is not on it, 404 when the door is in none of the caller's organizations, 422 for a pin outside the turf, 429 with 25 corrections awaiting review

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/doors/{door_id}/visits`

Records the caller's visit to a door, replacing their earlier one there,
and the survey answers when someone answered.

**Auth:** turf member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contactStatus` | `'no_contact'|'contacted'` |  | Required. The outcome |
| `attemptNote` | `string` |  | Optional. A note about the visit |
| `questions` | `any` |  | &#123;Array&lt;&#123; db_id: uuid, response: string &#125;>&#125; - Required. Answers, saved only when contacted |

**Response**

204 No Content. 400 for an invalid id or body, 401 when signed out, 403 unless the caller joined the turf, 404 when the door is in none of the caller's organizations

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

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/integrations/{integration_id}`

Turns an integration on or off for every organization on the instance.

**Auth:** infra settings.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enabled` | `any` |  | &#123;boolean&#125; |

**Response**

`{ enabled }`. 400 for an invalid id or body, 401 when signed out, 403 without `settings.manage`, 404 for an unknown integration

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/invitations/{invitation_id}`

Cancels a pending email invitation.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 when there is no pending invitation with that id

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/invite-links/{invite_link_id}`

Closes an invite link so it can no longer be used to join.

**Auth:** member.invite, or infra orgs.manage for any organization  

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/lists/{list_id}/locations`

Every location on a list with its pin, as the list recorded it, and the
latest outcome there on the list's turfs. For the list map and turf cutting.

**Auth:** Staff  

**Response**

`Array<{ record_id, record_source, name, address_line_1, city, state_or_region, postal_code, latitude, longitude, contact_made }>`. 400 for an invalid id or a list of people, 401 when signed out, 403 without staff access, 404 when the list is in none of the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/lists/{list_id}/turfs`

The list's turfs with their outlines, newest first, for the list map.

**Auth:** Staff  

**Response**

`Array<{ id, code, created_at, expires_at, author, survey_name, bounds }>`, `bounds` as GeoJSON text. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the list is in none of the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/lists/{list_id}/turfs`

Cuts one turf per polygon from the list. Each turf's doors are the list's
locations inside its polygon, at the versions the list recorded, and each
gets a six-character join code.

**Auth:** Staff  
**Permission:** `turf.create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `polygons` | `any` |  | &#123;Array&lt;&#123; geometry: GeoJSON &#125;>&#125; - Required, at least one |
| `survey_id` | `string` |  | Required. The survey canvassers fill in |
| `script_id` | `string|null` |  | Optional. The script canvassers read |
| `expires_at` | `string` |  | Optional. ISO date; 7 days from now when missing |

**Response**

201 with `{ turfs: Array<{ id, code, list_id, survey_id, script_id, expires_at, created_at }> }`. 400 for an invalid id or body, 401 when signed out, 403 without `turf.create`, 404 when the list is in none of the caller's organizations

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/location-edits/{edit_id}/approval`

Applies a canvasser's correction as a new version of the location.

**Auth:** Staff  
**Permission:** `location.update`

**Response**

`{ entity_id }`. 400 for an invalid id, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations, 409 when already reviewed or the location is gone

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/location-edits/{edit_id}/rejection`

Declines a canvasser's correction. It is kept, marked rejected.

**Auth:** Staff  
**Permission:** `location.update`

**Response**

204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations, 409 when already reviewed

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/location-suggestions/{suggestion_id}`

Rejects a volunteer's added location and removes it, with its turf door and
anything recorded there. An approved location cannot be removed this way.

**Auth:** Staff  
**Permission:** `location.delete`

**Response**

204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.delete`, 404 when it is in none of the caller's organizations, 409 when already reviewed

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/location-suggestions/{suggestion_id}/approval`

Approves a volunteer's added location: it joins buckets and future lists.
Lists made already are snapshots and do not gain it.

**Auth:** Staff  
**Permission:** `location.create`

**Response**

`{ entity_id }`. 400 for an invalid id, 401 when signed out, 403 without `location.create`, 404 when it is in none of the caller's organizations, 409 when already reviewed

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/locations/{entity_id}`

Changes the given fields of a location as a new version, so the old values
stay recoverable. Lists and turfs keep the version they recorded.

**Auth:** Staff  
**Permission:** `location.update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Any` | `any` |  | subset of the location fields (see POST /api/v1/organizations/[organization_id]/locations); omitted keys keep their value, keys sent as null are cleared |

**Response**

`{ entity_id, id }`, the location and its new contact version. 400 for an invalid id or body, 401 when signed out, 403 without `location.update`, 404 when it is in none of the caller's organizations or was deleted

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/locations/{entity_id}`

Soft-deletes a location. Its history, the lists and turfs it is on, and the
canvassing recorded there all stay.

**Auth:** Staff  
**Permission:** `location.delete`

**Response**

204 No Content. 400 for an invalid id, 401 when signed out, 403 without `location.delete`, 404 when it is in none of the caller's organizations or was already deleted

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/mail-tests`

Sends a short test email to the signed-in admin, to prove outgoing mail works.

**Auth:** infra settings.manage  

**Response**

`{ to }`. 403 without settings.manage, 409 when mail is not set up, 502 when the mail server refuses it

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/members/{member_id}`

Gives the member one organization role in place of the ones they hold.

**Auth:** member.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role_id` | `string|null` |  | The role, or null for only the default role |

**Response**

204. 400 for an invalid id or body, a role from another organization, or when it would leave no administrator, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/members/{member_id}`

Removes someone from their organization. Staff cannot remove themselves.

**Auth:** member.delete, or infra orgs.manage for any organization  

**Response**

204. 400 for an invalid id or when removing yourself, 401 when signed out, 403 without permission, 404 for a member the caller cannot see, 409 for the only owner

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/members/{member_id}/permissions/{permission_id}`

Grants or denies one permission to the member, whatever their roles say.

**Auth:** member.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `value` | `boolean` |  | true grants, false denies |

**Response**

204. 400 for an invalid id or body, or an unknown permission, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/members/{member_id}/permissions/{permission_id}`

Drops the member's override, so their roles decide this permission again.

**Auth:** member.update  

**Response**

204, also when there was no override. 400 for an invalid id, 401 when signed out, 403 without `member.update`, 404 when the member is not in the caller's organizations

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organization-slugs/{slug}`

Whether an organization URL slug is free, so the create form can flag a taken one as the user
types instead of after they submit.

**Auth:** user  

**Response**

`OrganizationSlugAvailability`, `{ available: boolean }`. 400 for a malformed slug, 401 when signed out

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/invite-links`

The organization's invite links, newest first, and whether its open slug invite is on.

**Auth:** member.invite  

**Response**

`{ links: Array<{ id, created_at, expires_at }>, slugInviteEnabled }`. 400 for an invalid id, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/invite-links`

Creates an invite link. Anyone with `/invite/{id}` can join until it expires.

**Auth:** member.invite  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `expires_at` | `string|null` |  | Optional. A date (`2026-12-31`) or ISO datetime; omitted or null never expires |

**Response**

201 with `{ id, created_at, expires_at }`. 400 for an invalid id or body, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/location-imports`

Imports locations from a CSV upload, each a business at a new address.
Invalid rows, including rows without a pin, are skipped and reported.

**Auth:** Staff  
**Permission:** `location.create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `multipart` | `any` |  | form with `file`, a .csv with a header row: name, address_line_1, address_line_2, city, state_or_region, postal_code, country_code, latitude, longitude (latitude and longitude required) |

**Response**

201 with `{ imported, skipped, errors: Array<{ row, reason }> }`. 400 without a .csv file or for an invalid id, 401 when signed out, 403 without `location.create`, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/location-markers`

The organization's current locations inside a map viewport, for the admin
map. Separate from the paginated collection, which is one alphabetical page
and so cannot say what is on screen. A viewport across the antimeridian
(west greater than east) is read as two boxes.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `west, south, east, north {number} - Required. Viewport corners in degrees` | `any` |  |

**Response**

`{ locations: Array<like GET .../locations items>, truncated: boolean }`, at most 2000 locations; `truncated` when there were more. 400 for an invalid id or viewport, 401 when signed out, 403 without `location.read`, 404 when the caller is not a member

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/locations`

Creates a location (a business at a new address), live at once, as staff
place one on the admin map.

**Auth:** Staff  
**Permission:** `location.create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name, address_line_1, address_line_2, city, state_or_region, postal_code {string|null} - Optional` | `any` |  |  |
| `country_code` | `string|null` |  | Optional. Two letters; the organization's usual country when missing |
| `latitude, longitude {number} - Required` | `any` |  |  |
| `photo_keys` | `string[]` |  | Optional. Object storage keys, at most 3 |

**Response**

201 with `{ entity_id, id }`, the location and its contact version. 400 for an invalid body, 401 when signed out, 403 without `location.create`, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/members`

The organization's members, one page at a time, ordered by name, each with their highest-priority role.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Optional. 1-based page of 100; out-of-range values are clamped to the nearest page |
| `q` | `string` | Optional. Only members whose name or email contains this |

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/people-imports`

Imports people from a CSV upload. Invalid rows are skipped and reported.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `multipart` | `any` |  | form with `file`, a .csv with a header row: first_name, last_name, middle_name, suffix, preferred_name, dob (YYYY-MM-DD), phone, email, gender |

**Response**

201 with `{ imported, skipped, errors: Array<{ row, reason }> }`. 400 without a .csv file or for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/photo-uploads`

Starts a location photo upload: answers a presigned PUT the browser sends
the file to, and the key to save on the location (`photo_keys`).

**Auth:** org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contentType` | `string` | ✓ | image/jpeg, image/webp, or image/png |
| `contentLength` | `number` | ✓ | Byte size, max 5,000,000 |

**Response**

201 with `{ url, key }`. 400 for an invalid body or id, 401 when signed out, 404 when the caller is not a member, 503 when object storage is not set up

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}`

Installs the plugin, or enables it again with the config it had.

**Auth:** plugin.manage  

**Response**

204. 400 for an invalid id, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown plugin or when the caller is not a member

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}`

Uninstalls the plugin. Its config is kept for a later reinstall.

**Auth:** plugin.manage  

**Response**

204. 400 for an invalid id, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown plugin or when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/api/{...path}`

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/api/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/api/{...path}`

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/api/{...path}`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/api/{...path}`

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/plugins/{slug}/config`

Replaces an installed plugin's config.

**Auth:** plugin.manage  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `The` | `any` |  | config object, checked against the plugin's `configSchema` when it has one |

**Response**

204. 400 for an invalid id or config, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown or uninstalled plugin, or when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/restorations`

Restores a deleted organization.

**Auth:** infra orgs.manage  

**Response**

204. 400 for an invalid id, 403 without orgs.manage, 404 for an unknown org, 409 when not deleted

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/roles`

The organization's permission roles, highest priority (lowest weight) first.

**Auth:** role.read  

**Response**

`Array<{ id, name, is_default, weight, permissions: string[] }>`. 400 for an invalid id, 401 when signed out, 403 without `role.read`, 404 when the caller is not a member

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/roles`

Creates a role that grants nothing yet; set its permissions with
`PUT /api/v1/roles/{role_id}/permissions`.

**Auth:** role.create  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name, 1 to 255 characters |
| `weight` | `number` |  | Optional. Priority from 1 to 10000, lower first; defaults to 500 |

**Response**

201 with the role. 400 for an invalid id or body, 401 when signed out, 403 without `role.create`, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/search`

The staff search box: up to five surveys, turfs, members, locations, and
people matching `q`, each only when the caller may read that kind.

**Auth:** Staff  

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `q` | `string` | The text; under two characters returns nothing |

**Response**

`{ surveys, turfs, members, locations, people }`, each `Array<{ id, title, subtitle, href }>`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/organizations/{organization_id}/slug-invite`

Turns the open slug invite on or off. While on, anyone with
`/invite/{org_slug}` can join.

**Auth:** member.invite  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enabled` | `any` |  | &#123;boolean&#125; |

**Response**

`{ enabled }`. 400 for an invalid id or body, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member

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

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/organizations/{organization_id}/turf-memberships`

Joins the caller to the turf with this code, so it shows on their map.
Joining a turf they are already on changes nothing.

**Auth:** member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `code` | `string` |  | The turf's 6-character join code |

**Response**

201 with `{ id }`, the turf's id. 400 for an invalid id or body, 401 when signed out, 404 for an unknown code or when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/organizations/{organization_id}/universe-stats`

How many people and locations the organization has now.

**Auth:** Staff  

**Response**

`{ people: number, locations: number }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/photos/{...key}`

Shows a stored location photo by redirecting to a short-lived presigned
link. The key is the one the upload answered (`orgs/{org id}/locations/...`).

**Auth:** org member  

**Response**

302 to the presigned link. 401 when signed out, 404 when the key is not a location photo in one of the caller's orgs, 503 when object storage is not set up

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/queries`

Runs Quick Search queries: plain selects of named columns from the tables
the query builder allows, for infra admins.

**Auth:** infra admin  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `queries` | `any` |  | &#123;Array&lt;&#123; select: string[], from: string, ... &#125;>&#125; - Required |

**Response**

`{ results: Array<{ fields: string[], rows: object[] }> }`. 400 for a query the builder refuses or that fails, 401 when signed out, 403 for anyone else

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/roles/{role_id}`

One permission role with the keys it grants.

**Auth:** role.read  

**Response**

`{ id, name, is_default, weight, permissions: string[] }`. 400 for an invalid id, 401 when signed out, 403 without `role.read`, 404 when it is not in the caller's organizations

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/roles/{role_id}`

Renames a role.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Display name, 1 to 255 characters |

**Response**

The role. 400 for an invalid id or body, 401 when signed out, 403 without `role.update`, 404 when it is not in the caller's organizations, 409 for the default role

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/roles/{role_id}`

Deletes a role. Its members keep any other roles they hold.

**Auth:** role.delete  

**Response**

204. 400 for an invalid id, 401 when signed out, 403 without `role.delete`, 404 when it is not in the caller's organizations, 409 for the default role

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/api/v1/roles/{role_id}/permissions`

Makes the role grant exactly the keys sent. The administrator role (weight 0)
keeps `system.access` even when it is left out.

**Auth:** role.update  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `permissions` | `string[]` |  | Every `resource.action` key the role grants |

**Response**

The role. 400 for an invalid id, body, or unknown key, 401 when signed out, 403 without `role.update`, 404 when it is not in the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/scripts/{script_id}`

One script with its text.

**Auth:** Staff  

**Response**

`{ id, bucket_id, name, updated_at, contents }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/scripts/{script_id}`

Updates the given fields of a script and leaves the rest as they are.

**Auth:** Staff  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` |  | Optional. Display name, 1 to 255 characters |
| `contents` | `string` |  | Optional. The script text |

**Response**

The script as `GET` returns it. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/surveys/{survey_id}/results`

The answers to a survey on the turfs cut from a bucket's lists, grouped by
door and question, for the results map.

**Auth:** Staff  
**Permission:** `response.read`

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bucketId` | `string` | Required. The bucket |
| `startDate, endDate {string} - Optional. YYYY-MM-DD, inclusive` | `any` |  |

**Response**

`Array<{ id, name, address_line_1, city, latitude, longitude, questions: Array<{ id, text, type, choices, orderIndex, responses: Array<{ value, respondedAt, respondedBy }> }> }>`. 400 for an invalid id or query, 401 when signed out, 403 without `response.read`, 404 when the survey or bucket is in none of the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/system-health`

How the running instance is doing: Node and Postgres versions, database size and largest tables,
connection pool use, and whether mail, storage, and Chromium are set up.

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

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/turfs/{turf_id}`

A turf's outline and doors, as the turf recorded them, with the latest
outcome at each, for the map preview.

**Auth:** Staff  

**Response**

`{ turf: { id, code, bounds }, locations: Array<{ id, name, address_line_1, city, state_or_region, latitude, longitude, contact_made }> }`, `bounds` as GeoJSON text. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is in none of the caller's organizations

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/turfs/{turf_id}/doors`

Whether each door on the turf has been visited, and the latest outcome, for
the canvasser's map.

**Auth:** turf member  

**Response**

`Array<{ id, visited: boolean, contact_made: boolean | null }>`. 400 for an invalid id, 401 when signed out, 403 unless the caller joined the turf, 404 when it is in none of the caller's organizations

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/turfs/{turf_id}/locations`

Adds a location a volunteer found in the field that was not on the turf. It
goes onto the turf at once, so they can knock it now, but it is tentative:
it stays out of buckets, lists, and future turfs until staff approve it.

**Auth:** turf member, while the turf is open  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Location` | `any` |  | fields (see POST /api/v1/organizations/[organization_id]/locations); the pin must be inside the turf |

**Response**

201 with `{ turf_location_id, entity_id }`. 400 for an invalid id or body, 401 when signed out, 403 when the turf is closed or the caller is not on it, 404 when it is in none of the caller's organizations, 422 for a pin outside the turf, 429 with 25 additions awaiting review

---

### ![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square) `/api/v1/turfs/{turf_id}/locations/{entity_id}`

Corrects a location the caller added to the turf, while it is still
awaiting review and the turf is open. The turf's door follows the correction.

**Auth:** the volunteer who added it  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `Any` | `any` |  | subset of the location fields |

**Response**

`{ entity_id, id }`. 400 for an invalid id or body, 401 when signed out, 403 once reviewed, when the turf has closed, or for someone else's addition, 404 when the turf is in none of the caller's organizations, 422 for a pin moved outside the turf

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/turfs/{turf_id}/locations/{entity_id}`

Withdraws a location the caller added by mistake, with its door and
anything recorded there, under the same conditions as correcting it.

**Auth:** the volunteer who added it  

**Response**

204 No Content. 400 for an invalid id, 401 when signed out, 403 once reviewed, when the turf has closed, or for someone else's addition, 404 when the turf is in none of the caller's organizations

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

# List Documents

Staff endpoints for generating, polling, downloading, and deleting the printable PDF of a location list.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/documents/{document_id}`

A list document's status, plus a download link once it is ready. This is
the URL POST /api/v1/lists/&#123;list_id&#125;/documents hands back in Location; poll
it until the status is no longer `pending`. The link is a presigned
object-storage URL that expires after 5 minutes and downloads the file as an
attachment named after the list. Soft-deleted documents, and documents
outside the caller's organizations, return 404.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at, download_url: string | null }`. `error` is a message safe to show users; `download_url` is set only when `status` is `ready`

---

### ![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square) `/api/v1/documents/{document_id}`

Soft-deletes a list document, so the list has no current PDF until one is
generated again. The file stays in object storage; retention cleans it up
later (#174). Deleting a document that is still generating lets the render
finish but keeps its result hidden.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

204 No Content. 404 if the document is not in the caller's organizations or is already deleted

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/api/v1/lists/{list_id}/documents`

The list's current documents (generated PDFs), newest first. Replaced and
deleted documents are not included, so this is normally at most one, plus a
failed attempt when a regeneration failed and the previous PDF was restored.
No download links here; fetch a document by id for that.

**Auth:** Staff  
**Permission:** `system.access`

**Response**

`Array<{ id, list_id, status: 'pending' | 'ready' | 'failed', error: string | null, created_at, completed_at }>`, at most 20

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/api/v1/lists/{list_id}/documents`

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
