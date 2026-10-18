import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requestedPage } from '$lib/shared/utils/pagination';
import { queryListEntriesPage } from '$lib/server/services/lists.service';

export async function load({ params, locals, url }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		// Load the list and verify it belongs to this org + bucket.
		const listResult = await client.query<{
			id: string;
			name: string;
			entity_type: string;
			expires_at: string;
			created_at: string;
		}>(
			`SELECT l.id, l.name, l.entity_type, l.expires_at, l.created_at
			 FROM universe.list l
			 JOIN universe.bucket b ON b.id = l.bucket
			 WHERE l.id = $1 AND l.org_id = $2 AND b.slug = $3`,
			[params.id, locals.organization!.id, params.slug]
		);

		if (listResult.rows.length === 0) throw error(404, 'List not found');

		const list = listResult.rows[0];

		const entries = await queryListEntriesPage(
			client,
			locals.organization!.id,
			list,
			requestedPage(url)
		);

		const turfsResult = await client.query<{
			id: string;
			code: string;
			expires_at: string;
			created_at: string;
			author: string;
			survey_name: string | null;
			location_count: string;
			attempted_count: string;
		}>(
			`SELECT
				t.id, t.code, t.expires_at, t.created_at,
				u.username AS author,
				s.name AS survey_name,
				COUNT(tl.id)::text AS location_count,
				COUNT(tla.id)::text AS attempted_count
			 FROM universe.turf t
			 JOIN auth.user u ON t.author_id = u.id
			 LEFT JOIN universe.survey s ON t.survey_id = s.id
			 LEFT JOIN universe.turf_location tl ON tl.turf_id = t.id
			 LEFT JOIN LATERAL (
			 	SELECT id FROM universe.turf_location_attempt
			 	WHERE turf_location_id = tl.id
			 	LIMIT 1
			 ) tla ON true
			 WHERE t.list_id = $1 AND t.org_id = $2
			 GROUP BY t.id, u.username, s.name
			 ORDER BY t.created_at DESC`,
			[list.id, locals.organization!.id]
		);

		const pdfResult = await client.query(
			`SELECT 1 FROM universe.list_document
			 WHERE list_id = $1 AND org_id = $2 AND status = 'ready' AND deleted_at IS NULL
			 LIMIT 1`,
			[list.id, locals.organization!.id]
		);

		return {
			list,
			entries: entries.items,
			entryCount: entries.totalCount,
			page: entries.page,
			pageSize: entries.pageSize,
			turfs: turfsResult.rows,
			hasPdf: (pdfResult.rowCount ?? 0) > 0
		};
	});
}
