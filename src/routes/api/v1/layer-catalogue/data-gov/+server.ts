import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { searchDataGov } from '$lib/server/services/layer-catalogue.service';
import { dataGovSearchSchema } from '$lib/shared/schemas/layer-catalogue';

/**
 * Searches data.gov for datasets that can be loaded as map layers. data.gov does not allow
 * browser requests, so the map editor asks through here.
 *
 * @auth user
 * @query `q` the search text (optional), `after` the `next` cursor of the previous page, `official=1` for government publishers only
 * @returns `DataGovSearchResult`. 400 for a bad query, 401 when signed out, 502 when data.gov cannot be reached
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requireUser(locals);

	const query = dataGovSearchSchema.safeParse({
		q: url.searchParams.get('q') ?? undefined,
		after: url.searchParams.get('after') ?? undefined,
		official: url.searchParams.get('official') ?? undefined
	});
	if (!query.success) throw error(400, query.error.issues[0].message);

	return json(await searchDataGov(query.data.q, query.data.after, query.data.official));
};
