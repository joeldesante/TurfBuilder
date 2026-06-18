import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';

const OvertureRecordSchema = z.object({
	name: z.string().optional(),
	address_line_1: z.string().optional(),
	city: z.string().optional(),
	state_or_region: z.string().optional(),
	postal_code: z.string().optional(),
	country_code: z.string().max(2).optional(),
	longitude: z.number().min(-180).max(180),
	latitude: z.number().min(-90).max(90)
});

const BodySchema = z.object({
	records: z.array(OvertureRecordSchema).min(1).max(500)
});

export async function POST({ request, locals }) {
	if (!locals.organization?.role) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => null);
	const parsed = BodySchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { records } = parsed.data;
	const errors: { row: number; reason: string }[] = [];
	let imported = 0;

	await withOrgTransaction(locals.organization.id, async (client) => {
		for (let i = 0; i < records.length; i++) {
			const row = records[i];
			try {
				const entity = await client.query<{ id: string }>(
					`INSERT INTO universe.org_entity (org_id) VALUES ($1) RETURNING id`,
					[locals.organization!.id]
				);
				const entityId = entity.rows[0].id;

				await client.query(
					`INSERT INTO universe.org_location
					 (org_id, entity_id, name, address_line_1, city, state_or_region, postal_code, country_code, coordinates, source, authored_by)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
					   ST_SetSRID(ST_MakePoint($9::float8, $10::float8), 4326),
					   'overture', $11)`,
					[
						locals.organization!.id,
						entityId,
						row.name ?? null,
						row.address_line_1 ?? null,
						row.city ?? null,
						row.state_or_region ?? null,
						row.postal_code ?? null,
						row.country_code ?? null,
						row.longitude,
						row.latitude,
						locals.user!.id
					]
				);
				imported++;
			} catch {
				errors.push({ row: i + 1, reason: 'Database insert failed' });
			}
		}
	});

	return json({ imported, skipped: records.length - imported - errors.length, errors });
}
