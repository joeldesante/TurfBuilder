import { can } from "$lib/auth-helpers";
import { error } from "@sveltejs/kit";

export async function load({ locals, parent }) {
	if (!can(locals.organization, "role", "read")) {
		throw error(403, 'You do not have permission to view roles.');
	}
}