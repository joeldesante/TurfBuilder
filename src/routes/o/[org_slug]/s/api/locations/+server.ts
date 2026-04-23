import type { RequestHandler } from './$types';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');
	if (!can(locals.organization, 'turf', 'create')) throw error(403, 'Forbidden');

	const lat_min = parseFloat(url.searchParams.get('lat_min') ?? '');
	const lat_max = parseFloat(url.searchParams.get('lat_max') ?? '');
	const lon_min = parseFloat(url.searchParams.get('lon_min') ?? '');
	const lon_max = parseFloat(url.searchParams.get('lon_max') ?? '');

	if ([lat_min, lat_max, lon_min, lon_max].some(isNaN)) {
		return new Response('Invalid coordinates', { status: 400 });
	}
	if (lat_min < -90 || lat_max > 90 || lon_min < -180 || lon_max > 180 || lat_min > lat_max || lon_min > lon_max) {
		return new Response('Coordinates out of range', { status: 400 });
	}

	const rows = await withOrgTransaction(locals.organization.id, async (client) => {
		const res = await client.query(
			`WITH viewport AS (
				SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
			)
			SELECT id, location_name, category, latitude, longitude, street, locality, postcode, region, country, tier
			FROM location_unified lu
			JOIN viewport v ON lu.geom && v.geom
			ORDER BY location_name
			LIMIT 500`,
			[lon_min, lat_min, lon_max, lat_max]
		);
		return res.rows;
	});

	return new Response(JSON.stringify(rows), {
		headers: { 'Content-Type': 'application/json' }
	});
};
