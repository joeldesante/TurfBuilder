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

	// A user must have an assigned org role to access staff pages.
	// Owner roles bypass all permission checks; other roles need at least one permission.
	if (!locals.organization.role) {
		throw error(403, 'You do not have staff access to this organization.');
	}

	console.log('[DEBUG] locals.organization:', JSON.stringify(locals.organization));
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
