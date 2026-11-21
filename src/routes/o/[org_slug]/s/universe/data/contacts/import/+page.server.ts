import { error } from '@sveltejs/kit';
import {
	isContactImportAvailable,
	listContactImports
} from '$lib/server/services/contact-imports.service';
import { listContactSchemas } from '$lib/server/services/contact-schemas.service';
import { IMPORTS_KEY, parseImportState } from '$lib/shared/utils/import-state';

export async function load({ locals, url, depends }) {
	// Lets the page read its data again without re-running the layouts around it.
	depends(IMPORTS_KEY);

	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.organization) throw error(404, 'Organization not found');

	const available = await isContactImportAvailable(locals.user.id, locals.organization.id);
	const schemas = await listContactSchemas(locals.user.id, locals.organization.id);
	const imports = available ? await listContactImports(locals.user.id, locals.organization.id) : [];

	// Where the person was, from the address. Only a file that is still listed counts.
	const kept = parseImportState(url.searchParams);
	const restore = kept && imports.some((file) => file.id === kept.fileId) ? kept : null;

	return { available, schemas, imports, restore };
}
