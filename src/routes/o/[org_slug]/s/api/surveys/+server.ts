import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';
import { logger } from '$lib/server/logger';

/**
 * Lists surveys for the organization, optionally filtered by bucket.
 *
 * @auth staff
 * @permission survey:read
 * @query bucketId {string} optional - bucket UUID to filter by
 * @query bucketSlug {string} optional - bucket slug to filter by (alternative to bucketId)
 * @returns Array of { id: string, name: string, description: string | null }
 */
export async function GET({ locals, url }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'read')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const bucketId = url.searchParams.get('bucketId');
	const bucketSlug = url.searchParams.get('bucketSlug');

	try {
		return await withOrgTransaction(locals.organization.id, async (client) => {
			let result;
			if (bucketId) {
				result = await client.query(
					`SELECT id, name FROM universe.survey WHERE org_id = $1 AND bucket_id = $2 ORDER BY name ASC`,
					[locals.organization!.id, bucketId]
				);
			} else if (bucketSlug) {
				result = await client.query(
					`SELECT s.id, s.name FROM universe.survey s
					 JOIN universe.bucket b ON b.id = s.bucket_id
					 WHERE s.org_id = $1 AND b.slug = $2 AND b.org_id = $1
					 ORDER BY s.name ASC`,
					[locals.organization!.id, bucketSlug]
				);
			} else {
				result = await client.query(
					`SELECT id, name FROM universe.survey WHERE org_id = $1 ORDER BY name ASC`,
					[locals.organization!.id]
				);
			}
			return json(result.rows);
		});
	} catch (error) {
		logger.error({ err: error }, 'Error fetching surveys');
		return json({ error: 'Failed to fetch surveys' }, { status: 500 });
	}
}

/**
 * Creates a new survey template for the organization with no questions.
 * Questions are added separately via the /questions endpoint.
 *
 * @auth staff
 * @permission survey:create
 * @body name {string} required - Survey name, 1–255 characters
 * @returns { id: string } UUID of the created survey
 */
export async function POST({ request, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'create')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { name, bucketId }: { name: string; bucketId: string } = await request.json();

		if (!name || name.trim() === '') {
			return json({ error: 'Name is required.' }, { status: 400 });
		}
		if (name.trim().length > 255) {
			return json({ error: 'Name must be 255 characters or fewer.' }, { status: 400 });
		}
		if (!bucketId) {
			return json({ error: 'bucketId is required.' }, { status: 400 });
		}

		const result = await withOrgTransaction(locals.organization.id, async (client) => {
			const bucketCheck = await client.query(
				`SELECT id FROM universe.bucket WHERE id = $1 AND org_id = $2`,
				[bucketId, locals.organization!.id]
			);
			if (bucketCheck.rows.length === 0) {
				throw Object.assign(new Error('Bucket not found'), { status: 404 });
			}

			return client.query(
				`INSERT INTO universe.survey (name, org_id, bucket_id) VALUES ($1, $2, $3) RETURNING id`,
				[name.trim(), locals.organization!.id, bucketId]
			);
		});

		return json({ id: result.rows[0].id }, { status: 201 });
	} catch (error) {
		logger.error({ err: error }, 'Error creating survey');
		return json({ error: 'Failed to create survey' }, { status: 500 });
	}
}
