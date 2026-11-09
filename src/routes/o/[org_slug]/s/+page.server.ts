import { getDashboard } from '$lib/server/services/dashboard.service';
import { parseRange } from '$lib/dashboard-range';

export async function load({ parent, locals, url }) {
	await parent();

	// ?bucket=<slug>; none (or an unknown slug) means the entire universe.
	// ?range=7d|30d; none (or unknown) means all time.
	return getDashboard(
		locals.user!.id,
		locals.organization!.id,
		url.searchParams.get('bucket'),
		parseRange(url.searchParams.get('range'))
	);
}
