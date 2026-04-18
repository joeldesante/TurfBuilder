import { redirect, error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getActivePlugins } from '$lib/server/plugins';

export async function load({ locals, parent }) {
	const parentData = await parent();

	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	if (!locals.organization) {
		throw redirect(303, '/orgs');
	}

	if (!can(locals.organization, 'system', 'access')) {
		throw error(403, 'You do not have system access for this organization.');
	}

	const activePlugins = await getActivePlugins(locals.organization.id);

	return {
		...parentData,
		organization: locals.organization,
		activePlugins: activePlugins.map((p) => ({
			slug: p.manifest.slug,
			name: p.manifest.name,
			navEntries: p.manifest.navEntries?.(locals.organization!.slug) ?? [],
			requiredPermission: p.manifest.requiredPermission
		}))
	};
}
