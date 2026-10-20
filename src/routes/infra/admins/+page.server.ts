import { listInfraAdmins, listInfraRoles } from '$lib/server/services/infra-admins.service';

export async function load({ locals }) {
	const userId = locals.user!.id;
	const [admins, roles] = await Promise.all([listInfraAdmins(userId), listInfraRoles(userId)]);
	return { admins, roles };
}
