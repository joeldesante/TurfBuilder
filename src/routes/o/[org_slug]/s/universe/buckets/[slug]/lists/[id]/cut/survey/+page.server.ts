import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { listBucketSurveys } from '$lib/server/services/surveys.service';

export async function load({ params, parent, locals }) {
	if (!can(locals.organization, 'survey', 'read')) throw error(403, 'Forbidden.');
	const { bucket } = await parent();

	const surveys = await listBucketSurveys(locals.user!.id, bucket.id);
	return {
		surveys: surveys.map(({ id, name, description }) => ({ id, name, description })),
		bucketSlug: params.slug,
		listId: params.id
	};
}
