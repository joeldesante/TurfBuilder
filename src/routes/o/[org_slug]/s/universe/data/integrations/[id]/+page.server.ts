import { error } from '@sveltejs/kit';
import { INTEGRATIONS } from '$lib/server/integrations';

export async function load({ params }) {
	const integration = INTEGRATIONS.find((i) => i.id === params.id);
	if (!integration) throw error(404, 'Integration not found');

	return { integration };
}
