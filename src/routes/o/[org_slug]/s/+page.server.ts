import { getDashboard } from '$lib/server/services/dashboard.service';
import { listMapLayers } from '$lib/server/services/map-layers.service';
import { parseRange } from '$lib/dashboard-range';

export async function load({ parent, locals, url }) {
	await parent();

	// ?bucket=<slug>; none (or an unknown slug) means the entire universe.
	// ?range=7d|30d; none (or unknown) means all time.
	// The map layers are only listed here (names and colors); the map fetches a layer's shapes
	// when it is turned on.
	const [dashboard, mapLayers] = await Promise.all([
		getDashboard(
			locals.user!.id,
			locals.organization!.id,
			url.searchParams.get('bucket'),
			parseRange(url.searchParams.get('range'))
		),
		listMapLayers(locals.user!.id, locals.organization!.id)
	]);
	return { ...dashboard, mapLayers };
}
