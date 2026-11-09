import { error } from '@sveltejs/kit';
import { listBucketSurveys } from '$lib/server/services/surveys.service';

export async function load({ locals, parent }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { bucket } = await parent();
	const surveys = await listBucketSurveys(locals.user.id, bucket.id);

	// The service lists by name; this page shows the most recently changed first.
	surveys.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

	return { surveys };
}
