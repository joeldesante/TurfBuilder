import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { searchCkanPortal } from '$lib/server/services/layer-catalogue.service';
import { ckanSearchSchema } from '$lib/shared/schemas/layer-catalogue';

/**
 * Searches one official city CKAN portal for datasets that can be loaded as map layers. The
 * portals do not allow browser requests, so the map editor asks through here. Only portals in
 * the registry can be named.
 *
 * @auth user
 * @query `portal` the portal id, `q` the search text (optional), `start` the `next` cursor of the previous page
 * @returns `CkanSearchResult`. 400 for a bad query or unknown portal, 401 when signed out, 502 when the portal cannot be reached
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requireUser(locals);

	const query = ckanSearchSchema.safeParse({
		portal: url.searchParams.get('portal') ?? undefined,
		q: url.searchParams.get('q') ?? undefined,
		start: url.searchParams.get('start') ?? undefined
	});
	if (!query.success) throw error(400, 'Choose a data portal to search.');

	return json(await searchCkanPortal(query.data.portal, query.data.q, query.data.start));
};
