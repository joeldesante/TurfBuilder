import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<{ id: string; name: string; description: string | null }>(
			`SELECT id, name, description
			 FROM public.map_layer
			 ORDER BY name ASC`
		);

		return {
			layers: result.rows.map((row) => ({
				id: row.id,
				label: row.name,
				description: row.description ?? undefined
			}))
		};
	});
}

const AddLayerSchema = z.object({
	layerId: z.uuid()
});

export const actions = {
	add: async ({ request, locals }) => {
		if (!locals.organization?.role) {
			return fail(403, { error: 'Forbidden.' });
		}

		const form = await request.formData();
		const parsed = AddLayerSchema.safeParse({ layerId: form.get('layerId') });
		if (!parsed.success) {
			return fail(400, { error: 'Invalid layer id.' });
		}

		return withOrgTransaction(locals.organization.id, async (client) => {
			try {
				await client.query(
					`INSERT INTO organization.map_layer (organization_id, map_layer_id)
					 VALUES ($1, $2)
					 ON CONFLICT (organization_id, map_layer_id) DO NOTHING`,
					[locals.organization!.id, parsed.data.layerId]
				);
			} catch (e) {
				if (e instanceof Object && 'code' in e && e.code === '23503') {
					return fail(404, { error: 'Layer not found.' });
				}
				throw e;
			}
			return { success: true };
		});
	}
};
