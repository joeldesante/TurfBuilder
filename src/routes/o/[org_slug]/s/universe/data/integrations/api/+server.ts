import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { POOL } from '$lib/server/database';
import { INTEGRATIONS, settingKey } from '$lib/server/integrations';

const patchSchema = z.object({
	id: z.string(),
	enabled: z.boolean()
});

export async function PATCH({ request, locals }) {
	if (!locals.organization) throw error(403, 'Forbidden');

	const body = await request.json().catch(() => null);
	const parsed = patchSchema.safeParse(body);
	if (!parsed.success) throw error(400, { message: 'Invalid request body' });

	const { id, enabled } = parsed.data;

	if (!INTEGRATIONS.some((i) => i.id === id)) {
		throw error(400, { message: 'Unknown integration' });
	}

	const key = settingKey(id);
	const client = await POOL.connect();
	try {
		await client.query(
			`INSERT INTO system_setting (key, value, description)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			[key, String(enabled), `Integration enabled flag: ${id}`]
		);
		return json({ ok: true });
	} finally {
		client.release();
	}
}
