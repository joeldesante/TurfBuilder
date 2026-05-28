import { withOrgTransaction } from '$lib/server/database';
import { runBucketEntityQuery } from '$lib/server/bucket-query';

export interface LocationRow {
	id: string;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
}

export async function load({ parent, locals }) {
	const { bucket } = await parent();

	if (!bucket.filter.locations.enabled || !bucket.filter.locations.query) {
		return { locations: [] as LocationRow[], enabled: false };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const rows = await runBucketEntityQuery(client, bucket.filter.locations.query!);
		return { locations: rows as unknown as LocationRow[], enabled: true };
	});
}
