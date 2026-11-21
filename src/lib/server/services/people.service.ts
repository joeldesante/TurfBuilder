import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import Papa from 'papaparse';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';

export interface OrgPersonRow {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	phone: string | null;
	dob: string | null;
}

// There are no person.* permission keys yet, so people use the staff check.
const PERMISSION = 'system.access';

/**
 * One page of the org's current people, by last then first name. For callers
 * that already hold an org transaction and have checked staff access.
 *
 * valid_to IS NULL keeps superseded versions out, so each person appears once.
 */
export async function queryOrgPeoplePage(
	client: PoolClient,
	orgId: string,
	requested: number
): Promise<Page<OrgPersonRow>> {
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count
		   FROM universe.org_person
		  WHERE org_id = $1 AND valid_to IS NULL`,
		[orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// The id tiebreak makes the order total, so pages cannot repeat or skip a row.
	const rows = await client.query<OrgPersonRow>(
		`SELECT id, first_name, last_name, email, phone, dob
		   FROM universe.org_person
		  WHERE org_id = $1 AND valid_to IS NULL
		  ORDER BY last_name NULLS LAST, first_name NULLS LAST, id
		  LIMIT $2 OFFSET $3`,
		[orgId, PAGE_SIZE, pageOffset(page)]
	);

	return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/** One page of the org's people. 404 unless the caller is a member, 403 without staff access. */
export async function listOrgPeople(
	userId: string,
	orgId: string,
	requested: number
): Promise<Page<OrgPersonRow>> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, (client) => queryOrgPeoplePage(client, orgId, requested));
}

/** A person's current version, as their profile page shows it. */
export interface PersonProfileRow {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	suffix: string | null;
	preferred_name: string | null;
	dob: string | null;
	phone: string | null;
	email: string | null;
	gender: string | null;
}

/**
 * A person's current version by its row id. 404 when the org has no current
 * version with that id; 404 unless the caller is a member, 403 without staff access.
 */
export async function getPerson(
	userId: string,
	orgId: string,
	personId: string
): Promise<PersonProfileRow> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	const person = await withOrgTransaction(orgId, async (client) => {
		const result = await client.query<PersonProfileRow>(
			`SELECT id, first_name, middle_name, last_name, suffix, preferred_name, dob, phone, email, gender
			   FROM universe.org_person
			  WHERE id = $1 AND org_id = $2 AND valid_to IS NULL`,
			[personId, orgId]
		);
		return result.rows[0];
	});
	if (!person) throw error(404, 'Person not found');

	return person;
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

const PersonRowSchema = z.object({
	first_name: z.string().optional(),
	last_name: z.string().optional(),
	middle_name: z.string().optional(),
	suffix: z.string().optional(),
	preferred_name: z.string().optional(),
	dob: z
		.string()
		.optional()
		.refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
			message: 'dob must be in YYYY-MM-DD format'
		}),
	phone: z.string().optional(),
	email: z.email('email is invalid').optional().or(z.literal('')),
	gender: z.string().optional()
});

export interface ImportResult {
	imported: number;
	skipped: number;
	/** The rows left out and why, numbered from 1 after the header. */
	errors: { row: number; reason: string }[];
}

/**
 * Adds a person for each valid row of a CSV with a header row (first_name,
 * last_name, middle_name, suffix, preferred_name, dob as YYYY-MM-DD, phone,
 * email, gender). Invalid rows are skipped and reported; the valid ones are
 * added together or not at all. 404 unless the caller is a member, 403
 * without staff access.
 */
export async function importPeopleCsv(
	userId: string,
	orgId: string,
	csv: string
): Promise<ImportResult> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	const candidates = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: true
	}).data;

	const errors: ImportResult['errors'] = [];
	const valid: z.infer<typeof PersonRowSchema>[] = [];
	candidates.forEach((row, i) => {
		// Empty cells count as missing, so optional fields pass.
		const normalized = Object.fromEntries(
			Object.entries(row).map(([k, v]) => [k, v === '' ? undefined : v])
		);
		const parsed = PersonRowSchema.safeParse(normalized);
		if (parsed.success) valid.push(parsed.data);
		else errors.push({ row: i + 1, reason: parsed.error.issues.map((e) => e.message).join('; ') });
	});

	if (valid.length > 0) {
		await withOrgTransaction(orgId, async (client) => {
			for (const row of valid) {
				const entity = await client.query<{ id: string }>(
					`INSERT INTO universe.org_entity (org_id) VALUES ($1) RETURNING id`,
					[orgId]
				);
				await client.query(
					`INSERT INTO universe.org_person
					 (org_id, entity_id, first_name, middle_name, last_name, suffix, preferred_name, dob, phone, email, gender, source, authored_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_import', $12)`,
					[
						orgId,
						entity.rows[0].id,
						row.first_name ?? null,
						row.middle_name ?? null,
						row.last_name ?? null,
						row.suffix ?? null,
						row.preferred_name ?? null,
						row.dob ?? null,
						row.phone ?? null,
						row.email || null,
						row.gender ?? null,
						userId
					]
				);
			}
		});
	}

	return { imported: valid.length, skipped: candidates.length - valid.length, errors };
}
