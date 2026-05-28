import { json } from '@sveltejs/kit';
import { z } from 'zod';
import Papa from 'papaparse';
import { withOrgTransaction } from '$lib/server/database.js';

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
	email: z.string().email('email is invalid').optional().or(z.literal('')),
	gender: z.string().optional()
});

type CandidateRow = Record<string, unknown>;

function parseCSV(text: string): CandidateRow[] {
	const result = Papa.parse<CandidateRow>(text, { header: true, skipEmptyLines: true });
	return result.data;
}

export async function POST({ request, locals }) {
	if (!locals.organization?.role) return json({ error: 'Unauthorized' }, { status: 401 });

	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	const name = file.name.toLowerCase();
	if (!name.endsWith('.csv')) {
		return json({ error: 'Unsupported file type. Upload a .csv file.' }, { status: 400 });
	}

	const text = await file.text();
	const candidates = parseCSV(text);

	const errors: { row: number; reason: string }[] = [];
	const valid: z.infer<typeof PersonRowSchema>[] = [];

	for (let i = 0; i < candidates.length; i++) {
		const row = candidates[i];
		// Normalize empty strings to undefined so optional fields pass validation
		const normalized = Object.fromEntries(
			Object.entries(row).map(([k, v]) => [k, v === '' ? undefined : v])
		);
		const parsed = PersonRowSchema.safeParse(normalized);
		if (parsed.success) {
			valid.push(parsed.data);
		} else {
			errors.push({ row: i + 1, reason: parsed.error.issues.map((e) => e.message).join('; ') });
		}
	}

	let imported = 0;
	if (valid.length > 0) {
		await withOrgTransaction(locals.organization.id, async (client) => {
			for (const row of valid) {
				const entity = await client.query<{ id: string }>(
					`INSERT INTO universe.org_entity (org_id) VALUES ($1) RETURNING id`,
					[locals.organization!.id]
				);
				const entityId = entity.rows[0].id;

				await client.query(
					`INSERT INTO universe.org_person
					 (org_id, entity_id, first_name, middle_name, last_name, suffix, preferred_name, dob, phone, email, gender, source, authored_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_import', $12)`,
					[
						locals.organization!.id,
						entityId,
						row.first_name ?? null,
						row.middle_name ?? null,
						row.last_name ?? null,
						row.suffix ?? null,
						row.preferred_name ?? null,
						row.dob ?? null,
						row.phone ?? null,
						row.email || null,
						row.gender ?? null,
						locals.user!.id
					]
				);
				imported++;
			}
		});
	}

	return json({ imported, skipped: candidates.length - imported, errors });
}
