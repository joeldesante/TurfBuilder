import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/list-access';
import { getScript } from '$lib/server/services/scripts.service';

export async function load({ params, locals, parent }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const scriptId = parseId(params.id, 'script');
	const [{ bucket }, script] = await Promise.all([parent(), getScript(locals.user.id, scriptId)]);

	// The URL names the bucket too; a script from another bucket is not this page's.
	if (script.bucket_id !== bucket.id) throw error(404, 'Script not found');

	return { script };
}
