import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireActiveMembership } from '$lib/server/list-access';
import { resolveOrgPermissions } from '$lib/server/permissions';

/**
 * The staff search box: surveys, turfs, members, locations, and people whose
 * names (or codes, emails, addresses) match, five of each, limited to what the
 * caller may read.
 */

export interface SearchHit {
	id: string;
	title: string;
	subtitle: string;
	href: string;
}

export interface SearchResults {
	surveys: SearchHit[];
	turfs: SearchHit[];
	members: SearchHit[];
	locations: SearchHit[];
	people: SearchHit[];
}

const EMPTY: SearchResults = { surveys: [], turfs: [], members: [], locations: [], people: [] };

/** A prefix-matching tsquery: "hello wor" becomes "hello:* & wor:*". */
function prefixQuery(q: string): string {
	return q
		.split(/\s+/)
		.map((w) => w.replace(/[^\w]/g, ''))
		.filter(Boolean)
		.map((w) => `${w}:*`)
		.join(' & ');
}

/**
 * Searches the org for `q` (at least two characters, or nothing is returned).
 * 404 unless the caller is a member, 403 without staff access.
 */
export async function searchOrganization(
	userId: string,
	orgId: string,
	q: string
): Promise<SearchResults> {
	await requireActiveMembership(userId, orgId);
	const text = q.trim();
	if (text.length < 2) return EMPTY;

	return withOrgTransaction(orgId, async (client) => {
		const granted = await resolveOrgPermissions(client, userId, orgId);
		const can = (key: string) => granted.includes(key);
		if (!can('system.access')) throw error(403, 'Forbidden');

		const slug = await client.query<{ slug: string }>(
			`SELECT slug FROM auth.organization WHERE id = $1`,
			[orgId]
		);
		const orgSlug = slug.rows[0].slug;
		const tsquery = prefixQuery(text);
		const none = { rows: [] as never[] };

		const surveys =
			can('survey.read') && tsquery
				? await client.query<{ id: string; title: string; subtitle: string; bucket_slug: string }>(
						`SELECT s.id, s.name AS title, COALESCE(s.description, '') AS subtitle, b.slug AS bucket_slug
						   FROM universe.survey s
						   JOIN universe.bucket b ON b.id = s.bucket_id AND b.org_id = s.org_id
						  WHERE s.org_id = $1
						    AND to_tsvector('simple', s.name || ' ' || COALESCE(s.description, ''))
						        @@ to_tsquery('simple', $2)
						  LIMIT 5`,
						[orgId, tsquery]
					)
				: none;

		const turfs = can('turf.read')
			? await client.query<{ id: string; title: string; list_id: string; bucket_slug: string }>(
					`SELECT t.id, t.code AS title, t.list_id, b.slug AS bucket_slug
					   FROM universe.turf t
					   JOIN universe.list l ON l.id = t.list_id AND l.org_id = t.org_id
					   JOIN universe.bucket b ON b.id = l.bucket AND b.org_id = t.org_id
					  WHERE t.org_id = $1 AND t.code ILIKE '%' || $2 || '%'
					  LIMIT 5`,
					[orgId, text]
				)
			: none;

		const members = can('member.read')
			? await client.query<{ id: string; title: string; subtitle: string }>(
					`SELECT u.id, u.name AS title, u.email AS subtitle
					   FROM auth.member m
					   JOIN auth.user u ON u.id = m.user_id
					  WHERE m.organization_id = $1
					    AND (u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
					  LIMIT 5`,
					[orgId, text]
				)
			: none;

		const locations =
			can('location.read') && tsquery
				? await client.query<{ id: string; title: string; subtitle: string }>(
						`SELECT entity_id AS id, COALESCE(name, address_line_1, '') AS title,
						        COALESCE(address_line_1 || ', ' || city, address_line_1, city, '') AS subtitle
						   FROM universe.v_contacts
						  WHERE to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(address_line_1, '') || ' ' || COALESCE(city, ''))
						        @@ to_tsquery('simple', $1)
						  LIMIT 5`,
						[tsquery]
					)
				: none;

		const people = await client.query<{ id: string; title: string; subtitle: string }>(
			`SELECT vp.id,
			        COALESCE(
			          NULLIF(TRIM(COALESCE(vp.first_name, '') || ' ' || COALESCE(vp.last_name, '')), ''),
			          'Unknown') AS title,
			        COALESCE(vp.email, '') AS subtitle
			   FROM universe.v_people vp
			  WHERE vp.first_name ILIKE '%' || $1 || '%'
			     OR vp.last_name  ILIKE '%' || $1 || '%'
			     OR vp.email      ILIKE '%' || $1 || '%'
			  LIMIT 5`,
			[text]
		);

		const base = `/o/${orgSlug}/s`;
		return {
			surveys: surveys.rows.map((r) => ({
				id: r.id,
				title: r.title,
				subtitle: r.subtitle,
				href: `${base}/universe/buckets/${r.bucket_slug}/surveys/${r.id}`
			})),
			turfs: turfs.rows.map((r) => ({
				id: r.id,
				title: r.title,
				subtitle: '',
				href: `${base}/universe/buckets/${r.bucket_slug}/lists/${r.list_id}/turfs/${r.id}`
			})),
			members: members.rows.map((r) => ({ ...r, href: `${base}/members/${r.id}` })),
			locations: locations.rows.map((r) => ({ ...r, href: `${base}/universe/entity/${r.id}` })),
			people: people.rows.map((r) => ({ ...r, href: `${base}/universe/people/${r.id}` }))
		};
	});
}
