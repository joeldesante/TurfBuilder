import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { POOL } from '$lib/server/database';
import { resolveInfraPermissions } from '$lib/server/permissions';

const patchSchema = z.object({
	subject: z.string().min(1),
	html_body: z.string().min(1)
});

export async function PATCH({ request, params, locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const infraPermissions = await resolveInfraPermissions(locals.user.id);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const body = await request.json().catch(() => null);
	const parsed = patchSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, { message: 'Invalid request body' });
	}

	const { subject, html_body } = parsed.data;

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`UPDATE email_template SET subject = $1, html_body = $2, updated_at = now() WHERE key = $3`,
			[subject, html_body, params.key]
		);
		if (result.rowCount === 0) {
			throw error(404, { message: 'Template not found' });
		}
		return json({ ok: true });
	} finally {
		client.release();
	}
}
