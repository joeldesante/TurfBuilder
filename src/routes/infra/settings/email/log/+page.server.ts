import { requestedPage } from '$lib/shared/utils/pagination';
import { emailLogFiltersFromUrl } from '$lib/shared/schemas/email-log';
import { emailLogTemplates, listEmailLog } from '$lib/server/services/email-log.service';

export async function load({ locals, url }) {
	const userId = locals.user!.id;
	const filters = emailLogFiltersFromUrl(url);
	const [page, templates] = await Promise.all([listEmailLog(userId, filters, requestedPage(url)), emailLogTemplates(userId)]);
	return { filters, page, templates };
}
