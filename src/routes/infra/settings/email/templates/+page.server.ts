import { listEmailTemplates } from '$lib/server/services/email-templates.service';

export async function load({ locals }) {
	return { templates: await listEmailTemplates(locals.user!.id) };
}
