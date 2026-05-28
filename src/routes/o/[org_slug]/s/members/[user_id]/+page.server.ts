import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { withOrgTransaction } from '$lib/server/database';
import { PERMISSIONS } from '$lib/permissions-config';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'member', 'read')) throw error(403, 'Forbidden.');

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const userResult = await client.query<{ id: string; name: string; email: string }>(
			`SELECT u.id, u.name, u.email
			 FROM auth.user u
			 JOIN auth.member m ON m.user_id = u.id
			 WHERE u.id = $1 AND m.organization_id = $2`,
			[params.user_id, locals.organization!.id]
		);
		if (userResult.rows.length === 0) throw error(404, 'Member not found.');
		const user = userResult.rows[0];

		const overridesResult = await client.query<{ registered_permission_id: string; value: boolean }>(
			`SELECT up.registered_permission_id, up.value
			 FROM user_permission up
			 JOIN auth.member m ON m.id = up.member_id
			 WHERE m.user_id = $1 AND up.organization_id = $2`,
			[params.user_id, locals.organization!.id]
		);
		const overrides = Object.fromEntries(
			overridesResult.rows.map((r) => [r.registered_permission_id, r.value])
		);

		const registeredResult = await client.query<{ id: string; key: string }>(
			`SELECT id, key FROM registered_permission WHERE scope = 'organization'`
		);
		const registeredMap = Object.fromEntries(registeredResult.rows.map((r) => [r.key, r.id]));

		const permissions = PERMISSIONS.filter((p) => registeredMap[p.key]).map((p) => ({
			id: registeredMap[p.key],
			key: p.key,
			label: p.label,
			group: p.group,
			description: p.description ?? null,
			value: overrides[registeredMap[p.key]] ?? null
		}));

		return { user, permissions, canManagePerms: can(locals.organization, 'member', 'update') };
	});
}
