import { parseTemplateKey } from '$lib/server/request';
import { getEmailTemplate } from '$lib/server/services/email-templates.service';

export async function load({ locals, params }) {
	return { template: await getEmailTemplate(locals.user!.id, parseTemplateKey(params.key)) };
}
