import { getSystemHealth } from '$lib/server/services/system-health.service';

export async function load({ locals }) {
	return { health: await getSystemHealth(locals.user!.id) };
}
