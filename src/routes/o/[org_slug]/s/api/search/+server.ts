import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

export async function GET({ locals, url }) {
	if (!locals.user || !locals.organization?.role) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) {
		return json({ surveys: [], turfs: [], members: [], locations: [], people: [] });
	}

	// Build a prefix-matching tsquery: "hello wor" → "hello:* & wor:*"
	// Uses the simple dictionary to avoid stop-word stripping ("this", "the", etc.)
	const tsquery = q.trim().split(/\s+/).map(w => w.replace(/[^\w]/g, '') + ':*').join(' & ');

	const org = locals.organization;

	return withOrgTransaction(org.id, async (client) => {
		const orgSlug = org.slug;

		const surveys = can(org, 'survey', 'read')
			? await client.query(
				`SELECT s.id, s.name AS title, COALESCE(s.description, '') AS subtitle, b.slug AS bucket_slug
				 FROM survey s
				 JOIN universe.bucket b ON b.id = s.bucket_id
				 WHERE s.organization_id = $1
				   AND to_tsvector('simple', s.name || ' ' || COALESCE(s.description, ''))
				       @@ to_tsquery('simple', $2)
				 LIMIT 5`,
				[org.id, tsquery]
			)
			: { rows: [] };

		const turfs = can(org, 'turf', 'read')
			? await client.query(
				`SELECT id, code AS title
				 FROM turf
				 WHERE organization_id = $1
				   AND code ILIKE '%' || $2 || '%'
				 LIMIT 5`,
				[org.id, q]
			)
			: { rows: [] };

		const members = can(org, 'member', 'read')
			? await client.query(
				`SELECT u.id, u.name AS title, u.email AS subtitle
				 FROM auth.member m
				 JOIN auth.user u ON u.id = m.user_id
				 WHERE m.organization_id = $1
				   AND (u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
				 LIMIT 5`,
				[org.id, q]
			)
			: { rows: [] };

		const locations = can(org, 'location', 'read')
			? await client.query(
				`SELECT id, location_name AS title,
				        COALESCE(street || ', ' || locality, street, locality, '') AS subtitle
				 FROM location_unified
				 WHERE organization_id = $1
				   AND to_tsvector('simple', location_name || ' ' || COALESCE(street, '') || ' ' || COALESCE(locality, ''))
				       @@ to_tsquery('simple', $2)
				 LIMIT 5`,
				[org.id, tsquery]
			)
			: { rows: [] };

		const people = await client.query(
			`SELECT
				vp.id,
				COALESCE(
					NULLIF(TRIM(COALESCE(vp.first_name, '') || ' ' || COALESCE(vp.last_name, '')), ''),
					vp.first_name,
					vp.last_name,
					'Unknown'
				) AS title,
				COALESCE(vp.email, '') AS subtitle
			FROM universe.v_people vp
			WHERE vp.first_name ILIKE '%' || $1 || '%'
			   OR vp.last_name  ILIKE '%' || $1 || '%'
			   OR vp.email      ILIKE '%' || $1 || '%'
			LIMIT 5`,
			[q]
		);

		return json({
			surveys:   surveys.rows.map(r => ({ ...r, href: `/o/${orgSlug}/s/universe/buckets/${r.bucket_slug}/surveys/${r.id}` })),
			turfs:     turfs.rows.map(r => ({ ...r, subtitle: '', href: `/o/${orgSlug}/s/turfs` })),
			members:   members.rows.map(r => ({ ...r, href: `/o/${orgSlug}/s/members/${r.id}` })),
			locations: locations.rows.map(r => ({ ...r, href: `/o/${orgSlug}/s/data/locations` })),
			people:    people.rows.map(r => ({ ...r, href: `/o/${orgSlug}/s/universe/people/${r.id}` })),
		});
	});
}
