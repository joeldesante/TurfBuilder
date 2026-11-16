import { goto } from '$app/navigation';
import { pageLoader } from '$lib/client/page-loader.svelte';

/** How the loader shows while navigating. See pageLoader.show(). */
export interface LoaderTiming {
	logoDelayMs?: number;
	logoMinMs?: number;
	slowMessageDelayMs?: number;
}

/**
 * The default: only a fade at first, so a quick load is not a flash of logo; if the load drags
 * the logo joins in and stays at least a second, and after 10 seconds a message says the server
 * is slow.
 */
const DEFAULT_TIMING: LoaderTiming = { logoDelayMs: 450, logoMinMs: 1000, slowMessageDelayMs: 10000 };

/**
 * For switching what a page shows (a bucket, a list or map view), where the person should see
 * the logo every time rather than a fade that is easy to miss: it shows at once and stays at
 * least 700ms.
 */
export const LOGO_AT_ONCE: LoaderTiming = { logoDelayMs: 0, logoMinMs: 700, slowMessageDelayMs: 10000 };

/**
 * Navigates behind the full-screen loader. The loader belongs to the root layout, so it survives
 * the navigation and is put away once the next page has rendered; it is only hidden here if the
 * navigation fails. `options` go to goto, such as `noScroll` for a page reloaded with new params,
 * and `timing` sets how the loader shows (DEFAULT_TIMING when left out).
 */
export async function navigateWithLoader(
	href: string | URL,
	options: Parameters<typeof goto>[1] = {},
	timing: LoaderTiming = DEFAULT_TIMING
): Promise<void> {
	pageLoader.show(timing);
	try {
		await goto(href, options);
	} catch (e) {
		pageLoader.hide();
		throw e;
	}
}
