import { redirect } from '@sveltejs/kit';
import { isSetupComplete } from '$lib/server/setup';

export async function load() {
	if (await isSetupComplete()) {
		throw redirect(303, '/');
	}
	return {};
}
