import { withOrgTransaction } from '$lib/server/database';
import { runBucketEntityQuery } from '$lib/server/bucket-query';

export interface PersonRow {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	phone: string | null;
	dob: Date | null;
}

export async function load({ parent, locals }) {
	const { bucket } = await parent();

	if (!bucket.filter.people.enabled || !bucket.filter.people.query) {
		return { people: [] as PersonRow[], enabled: false };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const rows = await runBucketEntityQuery(client, bucket.filter.people.query!);
		return { people: rows as unknown as PersonRow[], enabled: true };
	});
}
