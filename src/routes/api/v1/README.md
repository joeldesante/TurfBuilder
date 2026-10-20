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
- Helpers live in `$lib/shared/utils/pagination`. Each service exposes a `query...Page(client, orgId, page)` function for page loads that already hold an org transaction, and an access-checked `list...(userId, id, page)` for the endpoint.

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

### Access is checked in the service

The service checks access itself, so page loads that call it directly are checked too. Infra services call `requireInfraPermission(userId, key)` first, and every change an infra admin makes is written to the audit log by the service (`audit()` in `audit.service.ts`).

Some endpoints serve both org members and infra admins:

- GET /api/v1/organizations/[organization_id] - Members get the organization. Infra admins can read any organization, and theirs also carries `platform`: who runs it, its size, activity, and plugins.
- GET /api/v1/organizations/[organization_id]/members - Members need `member.read`; infra admins can read any organization's. Each row has the member's role, join date, and last activity there.

### Errors

Errors are SvelteKit `error(status, message)`, answered as `{ message }`. Messages are written for people, since the client shows them in a toast.

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
| POST | /api/v1/migrations | settings.manage |
