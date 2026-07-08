import { redirect, error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getActivePlugins } from '$lib/server/plugins';
import { withOrgTransaction } from '$lib/server/database';
import { parseBucketFilter } from '$lib/server/filter-converter';
import { isEmailVerificationDisabled } from '$lib/server/security';

export async function load({ locals, parent }) {
	const parentData = await parent();

	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	if (!locals.organization) {
		throw redirect(303, '/orgs');
	}

	if (!locals.user.emailVerified && !isEmailVerificationDisabled()) {
		throw redirect(303, '/auth/verify-email');
	}

	if (!can(locals.organization, 'system', 'access')) {
		throw error(403, 'You do not have system access for this organization.');
	}

	const [activePlugins, buckets] = await Promise.all([
		getActivePlugins(locals.organization.id),
		withOrgTransaction(locals.organization.id, async (client) => {
			const result = await client.query<{ id: string; name: string; slug: string; filter: unknown }>(
				`SELECT id, name, slug, filter FROM universe.bucket WHERE org_id = $1 ORDER BY name`,
				[locals.organization!.id]
			);
			return result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				slug: row.slug,
				filter: parseBucketFilter(row.filter),
			}));
		})
	]);

	return {
		...parentData,
		organization: locals.organization,
		buckets,
		activePlugins: activePlugins.map((p) => ({
			slug: p.manifest.slug,
			name: p.manifest.name,
			navEntries: p.manifest.navEntries?.(locals.organization!.slug) ?? [],
			requiredPermission: p.manifest.requiredPermission
		}))
	};
}
