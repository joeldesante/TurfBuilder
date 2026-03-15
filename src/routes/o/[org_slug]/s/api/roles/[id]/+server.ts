import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function PATCH({ params, request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can edit roles.' }, { status: 403 });
	}

	const { name, is_default } = await request.json();
	if (!name?.trim()) {
		return json({ error: 'Name is required.' }, { status: 400 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`UPDATE org_role SET name = $1, is_default = $2
			 WHERE id = $3 AND org_id = $4 AND is_owner = false
			 RETURNING id, name, is_owner, is_default`,
			[name.trim(), is_default ?? false, params.id, locals.organization.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be modified.' }, { status: 404 });
		}
		return json(result.rows[0]);
	} finally {
		client.release();
	}
}

export async function DELETE({ params, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can delete roles.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`DELETE FROM org_role WHERE id = $1 AND org_id = $2 AND is_owner = false`,
			[params.id, locals.organization.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Role not found or cannot be deleted.' }, { status: 404 });
		}
		return new Response(null, { status: 204 });
	} finally {
		client.release();
	}
}
