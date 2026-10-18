import { redirect } from '@sveltejs/kit';

// A bucket has no page of its own: open its first section, Locations, or the
// first one the sidebar offers when the bucket does not cover locations.
export async function load({ parent, params }) {
	const { bucket } = await parent();
	const base = `/o/${params.org_slug}/s/universe/buckets/${bucket.slug}`;
	// A bucket whose filters could not be converted opens on its filters page, where it can be rebuilt.
	const section = !bucket.filters
		? 'filters'
		: bucket.filters.locations
			? 'locations'
			: bucket.filters.people
			? 'people'
			: 'scripts';
	throw redirect(307, `${base}/${section}`);
}
