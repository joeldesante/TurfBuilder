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
- Helpers live in `$lib/server/pagination`. Each service exposes a `query...Page(client, orgId, page)` function for page loads that already hold an org transaction, and an access-checked `list...(userId, id, page)` for the endpoint.

Paginated today:

- GET /api/v1/organizations/[organization_id]/locations
- GET /api/v1/organizations/[organization_id]/people
- GET /api/v1/organizations/[organization_id]/members
- GET /api/v1/buckets/[bucket_id]/locations
- GET /api/v1/buckets/[bucket_id]/people
- GET /api/v1/lists/[list_id]/entries
