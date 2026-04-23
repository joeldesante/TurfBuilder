import { json } from '@sveltejs/kit';
import { z } from 'zod';
import Papa from 'papaparse';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

const LocationRowSchema = z.object({
	location_name: z.string().optional(),
	category: z.string().optional(),
	confidence: z.string().optional(),
	street: z.string().optional(),
	locality: z.string().optional(),
	postcode: z.string().optional(),
	region: z.string().optional(),
	country: z.string().optional(),
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180)
});

type CandidateRow = Record<string, unknown>;

function parseCSV(text: string): CandidateRow[] {
	const result = Papa.parse<CandidateRow>(text, { header: true, skipEmptyLines: true });
	return result.data;
}

function parseGeoJSON(text: string): { rows: CandidateRow[]; nonPointCount: number } {
	const geojson = JSON.parse(text);
	const features = geojson?.features ?? [];
	let nonPointCount = 0;
	const rows: CandidateRow[] = [];

	for (const feature of features) {
		if (feature?.geometry?.type !== 'Point') {
			nonPointCount++;
			continue;
		}
		const [longitude, latitude] = feature.geometry.coordinates;
		rows.push({ ...feature.properties, latitude, longitude });
	}

	return { rows, nonPointCount };
}

export async function POST({ request, locals, params }) {
	if (!locals.organization?.role) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!can(locals.organization, 'location', 'create')) return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	const name = file.name.toLowerCase();
	const text = await file.text();

	let candidates: CandidateRow[] = [];
	let skipped = 0;

	if (name.endsWith('.csv')) {
		candidates = parseCSV(text);
	} else if (name.endsWith('.geojson') || name.endsWith('.json')) {
		const { rows, nonPointCount } = parseGeoJSON(text);
		candidates = rows;
		skipped += nonPointCount;
	} else {
		return json({ error: 'Unsupported file type. Upload a .csv, .json, or .geojson file.' }, { status: 400 });
	}

	const errors: { row: number; reason: string }[] = [];
	const valid: z.infer<typeof LocationRowSchema>[] = [];

	for (let i = 0; i < candidates.length; i++) {
		const parsed = LocationRowSchema.safeParse(candidates[i]);
		if (parsed.success) {
			valid.push(parsed.data);
		} else {
			skipped++;
			errors.push({ row: i + 1, reason: parsed.error.issues.map((e) => e.message).join('; ') });
		}
	}

	if (valid.length > 0) {
		await withOrgTransaction(locals.organization.id, async (client) => {
			for (const row of valid) {
				await client.query(
					`INSERT INTO org_location
					 (organization_id, location_name, category, confidence, street, locality, postcode, region, country, latitude, longitude)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
					[
						locals.organization!.id,
						row.location_name ?? null,
						row.category ?? null,
						row.confidence ?? null,
						row.street ?? null,
						row.locality ?? null,
						row.postcode ?? null,
						row.region ?? null,
						row.country ?? null,
						row.latitude,
						row.longitude
					]
				);
			}
		});
	}

	return json({ imported: valid.length, skipped, errors });
}
