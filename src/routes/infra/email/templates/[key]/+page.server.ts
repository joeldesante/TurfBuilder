import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ parent, params }) {
	const { infraPermissions } = await parent();

	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT key, subject, html_body, variables, updated_at FROM email_template WHERE key = $1`,
			[params.key]
		);
		if (result.rowCount === 0) {
			throw error(404, 'Template not found');
		}
		const row = result.rows[0];
		return {
			templateKey: row.key,
			subject: row.subject,
			htmlBody: row.html_body,
			variables: row.variables as string[],
			updatedAt: row.updated_at
		};
	} finally {
		client.release();
	}
}
