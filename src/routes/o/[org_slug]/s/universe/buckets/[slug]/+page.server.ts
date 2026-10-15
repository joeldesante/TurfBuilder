import { redirect } from '@sveltejs/kit';

// A bucket has no page of its own: open its first section, Locations, or the
// first one the sidebar offers when the bucket does not cover locations.
export async function load({ parent, params }) {
	const { bucket } = await parent();
	const base = `/o/${params.org_slug}/s/universe/buckets/${bucket.slug}`;
	const section = bucket.filters.locations
		? 'locations'
		: bucket.filters.people
			? 'people'
			: 'scripts';
	throw redirect(307, `${base}/${section}`);
}
