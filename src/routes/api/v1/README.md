# API Schema

### Nested endpoints return collections and create new resources

- GET /api/v1/organizations/[organization_id]/buckets - Returns a list of that orgs buckets
- POST /api/v1/organizations/[organization_id]/buckets - Creates a new bucket on that org

### Flat endpoints are for operations on individual resources

- GET /api/vi/buckets/[bucket_id]
- PATCH /api/vi/buckets/[bucket_id]
- PUT /api/vi/buckets/[bucket_id]

### Endpoints use services!

Every endpoint in the API should use a service to manage its resources. There should never be raw SQL directly on an endpoint.

### Collections that can grow large are paginated

Collections whose size is unbounded (entities, bucket matches, list entries, members) take `?page=N` and return one page of 100:

```json
{ "items": [...], "totalCount": 4820, "page": 2, "pageSize": 100 }
```

- `page` is 1-based. A missing, nonsense, or out-of-range value is clamped to the nearest real page rather than rejected.
- Every page has a total order (ending in an id), so pages never repeat or skip a row.
- Helpers live in `$lib/shared/utils/pagination`. Each service exposes an access-checked `list...(userId, id, page)`, which both the endpoint and page loads call. The `query...Page(client, orgId, page)` beneath it is internal, for other services that already hold an org transaction.

Paginated today:

- GET /api/v1/organizations/[organization_id]/locations
- GET /api/v1/organizations/[organization_id]/people
- GET /api/v1/organizations/[organization_id]/members
- GET /api/v1/buckets/[bucket_id]/locations
- GET /api/v1/buckets/[bucket_id]/people
- GET /api/v1/lists/[list_id]/entries
- GET /api/v1/users, and the users' activity, email, and audit feeds
- GET /api/v1/organizations, and an organization's activity and audit feeds

### Every endpoint lives here

All API endpoints live under `/api/v1`, never as an `api/+server.ts` inside a page route. Pages load data by calling services from `+page.server.ts`; anything the browser fetches is an `/api/v1` endpoint. The route files call it through `$lib/client/api`, which turns failures into messages safe to show in a toast.

### Actions are resources

An action that is not plain CRUD is a noun the client creates or removes, not a verb in the path:

- PUT / DELETE /api/v1/users/[user_id]/suspension - Suspends or reinstates the user
- POST /api/v1/users/[user_id]/impersonations - Starts impersonating the user
- DELETE /api/v1/impersonations/current - Stops impersonating

### Input and output types are shared

- Request schemas live in `$lib/shared/schemas`, so the page that builds a request can validate with the same schema. Parse bodies with `parseBody()` from `$lib/server/request`.
- Response types live in `$lib/shared/types`.
- Every endpoint has a JSDoc header (`@auth`, `@query`, `@body`, `@returns`) and a spec beside it.

### Only services touch the database

Routes (endpoints, page and layout loads), `hooks.server.ts`, plugins, pages and browser code never import `$lib/server/database` or `pg`, and never write SQL. They call a service, and the service owns the queries and the transaction. The service is the adapter: when storage changes, only the service changes, not its callers. ESLint enforces this (`no-restricted-imports` in `eslint.config.js`), with no exceptions.

Public service functions take the caller's `userId` and the ids of what they act on, find the organization, check access, and open their own `withOrgTransaction`. `surveys.service.ts` is the reference. Functions that take a `PoolClient` are internal building blocks for other services (`contacts.service`, `addresses.service`, `query...Page`), and routes cannot call them.

### Access is checked in the service

The service checks access itself, so page loads that call it directly are checked too. Infra services call `requireInfraPermission(userId, key)` first, and every change an infra admin makes is written to the audit log by the service (`audit()` in `audit.service.ts`).

Some endpoints serve both org members and infra admins:

- GET /api/v1/organizations/[organization_id] - Members get the organization. Infra admins can read any organization, and theirs also carries `platform`: who runs it, its size, activity, and plugins.
- GET /api/v1/organizations/[organization_id]/members - Members need `member.read`; infra admins can read any organization's. Each row has the member's role, join date, and last activity there.

### Errors

Errors are SvelteKit `error(status, message)`, answered as `{ message }`. Messages are written for people, since the client shows them in a toast.

## Organization endpoints

### Locations

A location is a contact (a business, for now) at an address. The endpoints keep the flat fields the forms use (`name`, `address_line_1`, `address_line_2`, `city`, `state_or_region`, `postal_code`, `country_code`, `latitude`, `longitude`, `photo_keys`); `locations.service` maps them onto the contact and address tables.

| Method | Path | Permission |
|---|---|---|
| GET, POST | /api/v1/organizations/[organization_id]/locations | location.read, location.create |
| GET | /api/v1/organizations/[organization_id]/location-markers | location.read |
| POST | /api/v1/organizations/[organization_id]/location-imports | location.create |
| PATCH, DELETE | /api/v1/locations/[entity_id] | location.update, location.delete |
| PUT | /api/v1/location-suggestions/[suggestion_id]/approval | location.create |
| DELETE | /api/v1/location-suggestions/[suggestion_id] | location.delete |
| PUT | /api/v1/location-edits/[edit_id]/approval | location.update |
| PUT | /api/v1/location-edits/[edit_id]/rejection | location.update |

### Lists, turfs, and canvassing

Lists and turfs are snapshots: their entries and doors show the contact and address versions recorded when they were made.

| Method | Path | Permission |
|---|---|---|
| GET, POST | /api/v1/lists/[list_id]/turfs | staff, turf.create |
| GET | /api/v1/lists/[list_id]/locations | staff |
| GET | /api/v1/turfs/[turf_id] | staff |
| GET | /api/v1/turfs/[turf_id]/doors | turf member |
| POST | /api/v1/turfs/[turf_id]/locations | turf member, open turf |
| PATCH, DELETE | /api/v1/turfs/[turf_id]/locations/[entity_id] | the volunteer who added it, while tentative and the turf is open |
| POST | /api/v1/doors/[door_id]/edits | turf member, open turf |
| POST | /api/v1/doors/[door_id]/visits | turf member |

### Search and insights

| Method | Path | Permission |
|---|---|---|
| GET | /api/v1/organizations/[organization_id]/search | staff; each kind needs its read permission |
| GET | /api/v1/organizations/[organization_id]/universe-stats | staff |
| GET | /api/v1/surveys/[survey_id]/results | response.read |
| POST | /api/v1/queries | infra access |

## Infrastructure endpoints

### Users

| Method | Path | Permission |
|---|---|---|
| GET | /api/v1/users | access |
| GET | /api/v1/users/[user_id] | access |
| PATCH | /api/v1/users/[user_id] | users.manage |
| DELETE | /api/v1/users/[user_id] | users.manage |
| GET | /api/v1/users/[user_id]/memberships | access |
| GET | /api/v1/users/[user_id]/sessions | access |
| DELETE | /api/v1/users/[user_id]/sessions | users.manage |
| DELETE | /api/v1/sessions/[session_id] | users.manage |
| GET | /api/v1/users/[user_id]/activity-events | access |
| GET | /api/v1/users/[user_id]/email-logs | access |
| GET | /api/v1/users/[user_id]/audit-events | access |
| POST | /api/v1/users/[user_id]/password-resets | users.manage |
| POST | /api/v1/users/[user_id]/verification-emails | users.manage |
| DELETE | /api/v1/users/[user_id]/two-factor | users.manage |
| PUT, DELETE | /api/v1/users/[user_id]/suspension | users.manage |
| POST | /api/v1/users/[user_id]/impersonations | users.impersonate |
| DELETE | /api/v1/impersonations/current | the impersonating session |
| GET, POST | /api/v1/users/[user_id]/infra-roles | users.manage |
| DELETE | /api/v1/users/[user_id]/infra-roles/[role_id] | users.manage |
| GET | /api/v1/infra-roles | users.manage |

### Organizations

| Method | Path | Permission |
|---|---|---|
| GET | /api/v1/organizations | access |
| DELETE | /api/v1/organizations/[organization_id] | orgs.manage |
| POST | /api/v1/organizations/[organization_id]/restorations | orgs.manage |
| PUT, DELETE | /api/v1/organizations/[organization_id]/suspension | orgs.manage |
| PUT | /api/v1/organizations/[organization_id]/ownership | orgs.manage |
| GET | /api/v1/organizations/[organization_id]/invitations | access |
| GET | /api/v1/organizations/[organization_id]/activity-events | access |
| GET | /api/v1/organizations/[organization_id]/audit-events | access |
| DELETE | /api/v1/members/[member_id] | orgs.manage |
| DELETE | /api/v1/invitations/[invitation_id] | orgs.manage |
| DELETE | /api/v1/invite-links/[invite_link_id] | orgs.manage |

### Platform

| Method | Path | Permission |
|---|---|---|
| GET | /api/v1/metrics/[metric] | access |
| GET | /api/v1/audit-events | audit.read |
| GET | /api/v1/email-logs | settings.manage |
| GET, PATCH | /api/v1/system-settings | settings.manage |
| GET | /api/v1/email-templates | settings.manage |
| GET, PUT | /api/v1/email-templates/[template_key] | settings.manage |
| POST | /api/v1/email-templates/[template_key]/test-sends | settings.manage |
| POST | /api/v1/email-templates/[template_key]/resets | settings.manage |
| POST | /api/v1/mail-tests | settings.manage |
| POST | /api/v1/storage-tests | settings.manage |
| GET | /api/v1/system-health | access |
