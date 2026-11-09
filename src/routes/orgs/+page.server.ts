import { isOrgCreationAllowed } from '$lib/server/services/organizations.service';

export async function load() {
	return { allowCreation: await isOrgCreationAllowed() };
}
