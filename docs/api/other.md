# Other

Miscellaneous endpoints.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/uploads/{...key}`

Redirects to a short-lived presigned GET for a stored photo.

Objects are private, so this is the only way to display one. The key prefix
check is what stops a member of one org reading another org's photos by
pasting a key; without it the bucket would have to be public.

**Auth:** Org member  

**Response**

302 to a presigned URL

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/uploads/presign`

Issues a presigned PUT so the browser can upload a location photo straight
to Spaces.

Lives outside /s/ because volunteers attach photos to their suggestions and
do not have a staff role.

Org membership is the only check needed: the key is server-generated and
unguessable, and attaching it to a location still has to pass that
endpoint's own authorization.

**Auth:** Org member  

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `contentType` | `string` | ✓ | image/jpeg, image/webp, or image/png |
| `contentLength` | `number` | ✓ | Byte size, max 5,000,000 |

**Response**

&#123; url, key &#125;

---
