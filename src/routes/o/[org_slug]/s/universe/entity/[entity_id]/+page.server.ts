import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getEntity } from '$lib/server/services/entities.service';

const uuid = z.uuid();

export async function load({ params, locals, url }) {
	if (!locals.organization) throw error(401, 'Unauthorized');
	if (!uuid.safeParse(params.entity_id).success) throw error(404, 'Entity not found');

	// Optional: view a specific version by its version id.
	const versionParam = url.searchParams.get('version');
	const versionId = versionParam && uuid.safeParse(versionParam).success ? versionParam : null;
	if (versionParam && !versionId) throw error(404, 'Entity not found');

	// Optional: return path so the UI can show a "Back" link.
	let backHref: string | undefined;
	const backHrefParam = url.searchParams.get('backHref');
	if (backHrefParam) {
		try {
			const decoded = decodeURIComponent(backHrefParam);
			if (decoded.startsWith('/')) backHref = decoded;
		} catch {
			// Ignore malformed percent-encoding: backHref stays undefined.
		}
	}

	const entity = await getEntity(
		locals.user!.id,
		locals.organization.id,
		params.entity_id,
		versionId
	);
	return { ...entity, backHref };
}
