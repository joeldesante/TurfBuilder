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

/**
 * Parts of the app that take a moment to load, so the root layout raises the TurfBuilder loading
 * cover whenever a navigation enters one: from outside it, or from another instance of it (another
 * bucket). Moving around inside one (a bucket's locations to its people) does not raise it.
 *
 * Entries are route id prefixes. Their [params] tell instances apart.
 */
export const LOADER_INTO_ROUTE_PREFIXES: readonly string[] = ['/o/[org_slug]/s/universe/buckets/[slug]'];

/**
 * Single pages that take a moment to load, so the root layout raises the loading cover whenever a
 * navigation arrives at one from another page (the staff dashboard, coming back from a bucket).
 * A reload of the same page with new query params (the dashboard's bucket picker) does not count;
 * that page raises the cover itself. Exact route ids, like FADE_INTO_ROUTES.
 */
export const LOADER_INTO_ROUTES: readonly string[] = ['/o/[org_slug]/s'];

type NavigationEnd = { route: { id: string | null }; params: Record<string, string> | null } | null;

/** Whether a navigation from `from` to `to` enters a page of LOADER_INTO_ROUTES or LOADER_INTO_ROUTE_PREFIXES. */
export function entersLoaderRoute(from: NavigationEnd | undefined, to: NavigationEnd | undefined): boolean {
	const toId = to?.route.id;
	if (!toId) return false;
	if (LOADER_INTO_ROUTES.includes(toId)) return from?.route.id !== toId;
	const prefix = LOADER_INTO_ROUTE_PREFIXES.find((p) => toId === p || toId.startsWith(`${p}/`));
	if (!prefix) return false;

	const fromId = from?.route.id;
	if (!fromId || !(fromId === prefix || fromId.startsWith(`${prefix}/`))) return true;

	// Same part of the app: only another instance of it (a different bucket) counts as entering.
	const names = [...prefix.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
	return names.some((name) => from?.params?.[name] !== to?.params?.[name]);
}
