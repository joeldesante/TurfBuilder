import { error } from '@sveltejs/kit';
import { filterGroupSchema } from '$lib/shared/schemas/filters';
import { requestedPage } from '$lib/shared/utils/pagination';
import type { FilterGroup } from '$lib/shared/types/filters';
import {
	listAllContacts,
	listContactMarkers,
	listContactSchemas,
	listSchemaContacts,
	MAX_SEARCH_LENGTH
} from '$lib/server/services/contact-schemas.service';

/** The filter editor's document from `?filters=`, or null when it is missing or not a valid filter. */
function filtersFrom(url: URL): FilterGroup | null {
	const raw = url.searchParams.get('filters');
	if (!raw) return null;

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}
	const parsed = filterGroupSchema.safeParse(json);
	return parsed.success && parsed.data.filters.length > 0 ? parsed.data : null;
}

/**
 * The tabs are "All" and then the org's contact schemas in the order staff
 * arranged them. `?schema=<id>` picks a schema; a missing or unknown id shows
 * All. `?view=map` shows the tab's contacts on a map instead of a list. `?q=`
 * searches them and `?filters=` narrows them with the filter editor's document.
 * Only what the shown view needs is loaded.
 */
export async function load({ locals, url }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	const schemas = await listContactSchemas(locals.user.id, locals.organization.id);
	const requested = url.searchParams.get('schema');
	const selected = schemas.find((s) => s.id === requested) ?? null;

	const view: 'list' | 'map' = url.searchParams.get('view') === 'map' ? 'map' : 'list';
	const search = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
	const filters = filtersFrom(url);
	const options = { search, filters };

	if (view === 'map') {
		const markers = await listContactMarkers(
			locals.user.id,
			locals.organization.id,
			selected?.id ?? null,
			options
		);
		return {
			view,
			schemas,
			selected,
			search,
			filters,
			markers,
			contacts: [],
			totalCount: markers.length,
			page: 1,
			pageSize: 100
		};
	}

	const result = selected
		? await listSchemaContacts(locals.user.id, selected.id, requestedPage(url), options)
		: await listAllContacts(locals.user.id, locals.organization.id, requestedPage(url), options);

	return {
		view,
		schemas,
		selected,
		search,
		filters,
		markers: [],
		contacts: result.items,
		totalCount: result.totalCount,
		page: result.page,
		pageSize: result.pageSize
	};
}
