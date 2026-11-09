import { can } from '$lib/auth-helpers';
import { requestedPage } from '$lib/shared/utils/pagination';
import { getLocationsOverview } from '$lib/server/services/locations.service';

export async function load({ locals, url }) {
	const overview = await getLocationsOverview(
		locals.user!.id,
		locals.organization!.id,
		requestedPage(url)
	);

	return {
		totalCount: overview.totalCount,
		page: overview.page,
		pageSize: overview.pageSize,
		locations: overview.items,
		// Null when the org has no locations, which leaves the map on its own
		// default view rather than fitting to nothing.
		initialBounds: overview.bounds,
		canCreate: can(locals.organization, 'location', 'create'),
		canUpdate: can(locals.organization, 'location', 'update'),
		canDelete: can(locals.organization, 'location', 'delete')
	};
}
