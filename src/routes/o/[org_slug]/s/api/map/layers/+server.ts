import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';

export async function GET({ locals }) {
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}
	if (!locals.organization.role) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query<{
			id: string;
			name: string;
			geojson: GeoJSON.GeoJSON;
			visible: boolean;
		}>(
			`SELECT ml.id, ml.name, ml.geojson, oml.visible
			 FROM organization.map_layer oml
			 JOIN public.map_layer ml ON ml.id = oml.map_layer_id
			 WHERE oml.organization_id = $1
			 ORDER BY ml.name ASC`,
			[locals.organization!.id]
		);

		return json({
			layers: result.rows.map((row) => ({
				id: row.id,
				label: row.name,
				data: row.geojson,
				visible: row.visible
			}))
		});
	});
}

const SetVisibilitySchema = z.object({
	layerId: z.uuid(),
	visible: z.boolean()
});

export async function PATCH({ request, locals }) {
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}
	if (!locals.organization.role) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const body = await request.json();
	const parsed = SetVisibilitySchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const result = await client.query(
			`UPDATE organization.map_layer
			 SET visible = $1
			 WHERE organization_id = $2 AND map_layer_id = $3`,
			[parsed.data.visible, locals.organization!.id, parsed.data.layerId]
		);

		if (result.rowCount === 0) {
			return json({ error: 'Layer not found.' }, { status: 404 });
		}

		return json({ success: true });
	});
}
