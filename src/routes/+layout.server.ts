import { buildInfraNav } from '$lib/shared/utils/infra-nav';
import { getExternalLinks } from '$lib/server/services/system-settings.service';

export async function load({ locals }) {
	const permissions = locals.infrastructure?.permissions ?? [];

	// Only infra admins get the quick menu's entries; everyone else gets null,
	// so no infra links reach their pages at all.
	const infraMenu = permissions.includes('access')
		? { groups: buildInfraNav(permissions, await getExternalLinks().catch(() => [])) }
		: null;

	return {
		config: locals.config ?? null,
		infraMenu,
		// Off while impersonating, so an admin's clicks are not counted as the user's.
		analytics: locals.impersonatedBy ? null : (locals.analytics ?? null),
		// Id only: names and emails never go to analytics.
		analyticsUserId: locals.impersonatedBy ? null : (locals.user?.id ?? null),
		// Set while an infra admin is signed in as this user; drives the banner.
		impersonating:
			locals.impersonatedBy && locals.user ? { userId: locals.user.id, userName: locals.user.name } : null
	};
}
