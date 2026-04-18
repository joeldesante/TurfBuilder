import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/auth';

export async function POST({ request, locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { name, slug } = await request.json();
	if (!name || !slug) throw error(400, 'Name and slug are required');

	const result = await auth.api.createOrganization({
		headers: request.headers,
		body: { name, slug }
	});

	return json({ slug: result.slug });
}
