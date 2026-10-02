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
