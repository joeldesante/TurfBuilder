import { redirect } from '@sveltejs/kit';
import { isSetupComplete } from '$lib/server/setup';
import { getSettings } from '$lib/server/settings';

export async function load() {
	if (await isSetupComplete()) {
		try {
			await getSettings();
			// Settings loaded fine — setup is fully complete, redirect away.
			throw redirect(303, '/');
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw the redirect
			// Settings broken despite having users — stay on setup so it can be re-run.
		}
	}
	return {};
}
