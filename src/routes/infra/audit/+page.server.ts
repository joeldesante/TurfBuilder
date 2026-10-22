import { requestedPage } from '$lib/shared/utils/pagination';
import { auditFiltersFromUrl } from '$lib/shared/schemas/audit';
import { listAuditEvents } from '$lib/server/services/audit.service';

export async function load({ locals, url }) {
	const filters = auditFiltersFromUrl(url);
	return { filters, page: await listAuditEvents(locals.user!.id, filters, requestedPage(url)) };
}
