import { parseId } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import {
	getOrg,
	listOrgActivity,
	listOrgAudit,
	listOrgInvitations,
	listOrgMembers
} from '$lib/server/services/platform-organizations.service';
import { getOrgActivitySeries } from '$lib/server/services/platform-metrics.service';
import type { OrgTab } from '$pages/infra/orgs/InfraOrgDetailPage.svelte';

const TABS: OrgTab[] = ['overview', 'members', 'invitations', 'activity', 'audit'];

export async function load({ locals, params, url }) {
	const userId = locals.user!.id;
	const orgId = parseId(params.org_id, 'organization');
	const requestedTab = url.searchParams.get('tab') as OrgTab | null;
	const tab: OrgTab = requestedTab && TABS.includes(requestedTab) ? requestedTab : 'overview';
	const page = requestedPage(url);

	const org = await getOrg(userId, orgId);

	// The overview also needs the first page of members, to choose a new owner from.
	return {
		org,
		tab,
		members: tab === 'overview' || tab === 'members' ? await listOrgMembers(userId, orgId, tab === 'members' ? page : 1) : null,
		invitations: tab === 'invitations' ? await listOrgInvitations(userId, orgId) : null,
		activity: tab === 'activity' ? await listOrgActivity(userId, orgId, page) : null,
		audit: tab === 'audit' ? await listOrgAudit(userId, orgId, page) : null,
		activitySeries: tab === 'overview' ? await getOrgActivitySeries(userId, orgId) : []
	};
}
