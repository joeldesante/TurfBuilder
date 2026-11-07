import { goto } from '$app/navigation';
import { pageLoader } from '$lib/client/page-loader.svelte';

/**
 * Navigates behind the full-screen loader. Only a fade at first, so a quick load is not a flash
 * of logo; if the load drags the logo joins in and stays at least a second, and after 10 seconds
 * a message says the server is slow. The loader belongs to the root layout, so it survives the
 * navigation and is put away once the next page has rendered; it is only hidden here if the
 * navigation fails.
 */
export async function navigateWithLoader(href: string): Promise<void> {
	pageLoader.show({ logoDelayMs: 450, logoMinMs: 1000, slowMessageDelayMs: 10000 });
	try {
		await goto(href);
	} catch (e) {
		pageLoader.hide();
		throw e;
	}
}
