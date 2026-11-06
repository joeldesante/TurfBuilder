/**
 * The pages that fade in. Navigating to one of these cross-fades from the page you were on
 * instead of jumping. Pages not listed here keep the browser's normal instant swap.
 *
 * Entries are SvelteKit route ids, which is the folder path under `src/routes`, with parameters
 * in brackets, for example `/orgs`, `/orgs/create` or `/o/[org_slug]/s`. They match exactly, so
 * a nested page needs its own line.
 */
export const FADE_INTO_ROUTES: readonly string[] = ['/orgs'];

/** Whether navigating to the route with this id should fade. */
export function fadesInto(routeId: string | null | undefined): boolean {
	return routeId != null && FADE_INTO_ROUTES.includes(routeId);
}

/**
 * Pages that take over a loader raised before the navigation and put it away themselves, once
 * their own data has arrived. For every other page the root layout puts the loader away as soon
 * as the page has rendered. The org picker is one: its list loads after it mounts, so hiding the
 * loader on render would show the list filling in.
 */
export const LOADER_HANDOFF_ROUTES: readonly string[] = ['/orgs'];

/** Whether the page at this route id hides a loader raised before it, rather than the layout. */
export function hidesLoaderItself(routeId: string | null | undefined): boolean {
	return routeId != null && LOADER_HANDOFF_ROUTES.includes(routeId);
}
