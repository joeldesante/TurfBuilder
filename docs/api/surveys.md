# Surveys

Staff endpoints for creating and managing survey templates and questions.

---

### ![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square) `/o/{org_slug}/s/api/surveys`

Lists surveys for the organization, optionally filtered by bucket.

**Auth:** Staff  
**Permission:** `survey:read`

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bucketId` | `string` | optional - bucket UUID to filter by |
| `bucketSlug` | `string` | optional - bucket slug to filter by (alternative to bucketId) |

**Response**

Array of &#123; id: string, name: string, description: string | null &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys`

Creates a new survey template for the organization with no questions.
Questions are added separately via the /questions endpoint.

**Auth:** Staff  
**Permission:** `survey:create`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Survey name, 1–255 characters |

**Response**

&#123; id: string &#125; UUID of the created survey

---

### ![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}`

Updates the name and optional description of an existing survey.

**Auth:** Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ | Survey name, 1–255 characters |
| `description` | `string` |  | Survey description, max 2000 characters |

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}/questions`

Upserts questions for a survey. Questions with a `db_id` are updated;
those without are created. Typically called after `questions/purge` to
fully replace the question set.

**Auth:** Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `questions` | `Array` | ✓ | Array of question objects: db_id? (uuid), type (string), text (string), choices (string[]), index (number) |

**Response**

&#123; success: true &#125;

---

### ![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square) `/o/{org_slug}/s/api/surveys/{id}/questions/purge`

Deletes all questions for a survey except those listed in `exclude`.
Called before re-saving the full question set to remove questions the
editor dropped. Pass all retained question IDs in `exclude`.

**Auth:** Staff  
**Permission:** `survey:update`

**Request Body**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `exclude` | `string[]` |  | UUIDs of questions to keep; all others are deleted |

**Response**

&#123; success: true &#125;

---
