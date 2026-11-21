import { error } from '@sveltejs/kit';
import { listContactImportJobs } from '$lib/server/services/contact-import-jobs.service';

export async function load({ locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.organization) throw error(404, 'Organization not found');

	return { jobs: await listContactImportJobs(locals.user.id, locals.organization.id) };
}
