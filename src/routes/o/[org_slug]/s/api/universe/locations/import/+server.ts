import { json } from '@sveltejs/kit';
import { z } from 'zod';
import Papa from 'papaparse';
import { withOrgTransaction } from '$lib/server/database.js';

const LocationRowSchema = z.object({
	name: z.string().optional(),
	address_line_1: z.string().optional(),
	address_line_2: z.string().optional(),
	address_line_3: z.string().optional(),
	city: z.string().optional(),
	state_or_region: z.string().optional(),
	postal_code: z.string().optional(),
	country_code: z.string().max(2, 'country_code must be a 2-letter ISO code').optional(),
	latitude: z.coerce.number().min(-90).max(90).optional(),
	longitude: z.coerce.number().min(-180).max(180).optional()
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
	const valid: z.infer<typeof LocationRowSchema>[] = [];

	for (let i = 0; i < candidates.length; i++) {
		const row = candidates[i];
		const normalized = Object.fromEntries(
			Object.entries(row).map(([k, v]) => [k, v === '' ? undefined : v])
		);
		const parsed = LocationRowSchema.safeParse(normalized);
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
					`INSERT INTO universe.org_location
					 (org_id, entity_id, name, address_line_1, address_line_2, address_line_3, city, state_or_region, postal_code, country_code, coordinates, source, authored_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
					   CASE WHEN $11::float8 IS NOT NULL AND $12::float8 IS NOT NULL
					        THEN ST_SetSRID(ST_MakePoint($12::float8, $11::float8), 4326)
					        ELSE NULL END,
					   'manual_import', $13)`,
					[
						locals.organization!.id,
						entityId,
						row.name ?? null,
						row.address_line_1 ?? null,
						row.address_line_2 ?? null,
						row.address_line_3 ?? null,
						row.city ?? null,
						row.state_or_region ?? null,
						row.postal_code ?? null,
						row.country_code ?? null,
						row.latitude ?? null,
						row.longitude ?? null,
						locals.user!.id
					]
				);
				imported++;
			}
		});
	}

	return json({ imported, skipped: candidates.length - imported, errors });
}
