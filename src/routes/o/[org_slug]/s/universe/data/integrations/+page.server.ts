import { error } from '@sveltejs/kit';
import { listIntegrations } from '$lib/server/services/integrations.service';

export async function load({ params, locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	return {
		orgSlug: params.org_slug,
		integrations: await listIntegrations(locals.user.id, locals.organization.id)
	};
}
