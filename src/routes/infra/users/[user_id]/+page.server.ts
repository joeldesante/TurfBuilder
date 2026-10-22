import { parseId } from '$lib/server/list-access';
import { requestedPage } from '$lib/shared/utils/pagination';
import {
	getUser,
	listUserActivity,
	listUserAudit,
	listUserEmails,
	listUserMemberships,
	listUserSessions
} from '$lib/server/services/platform-users.service';
import { getUserActivitySeries } from '$lib/server/services/platform-metrics.service';
import type { UserTab } from '$pages/infra/users/InfraUserDetailPage.svelte';

const TABS: UserTab[] = ['overview', 'organizations', 'sessions', 'activity', 'emails', 'audit'];

export async function load({ locals, params, url }) {
	const userId = locals.user!.id;
	const targetId = parseId(params.user_id, 'user');
	const requestedTab = url.searchParams.get('tab') as UserTab | null;
	const tab: UserTab = requestedTab && TABS.includes(requestedTab) ? requestedTab : 'overview';
	const page = requestedPage(url);

	const [user, memberships, sessions] = await Promise.all([
		getUser(userId, targetId),
		listUserMemberships(userId, targetId),
		listUserSessions(userId, targetId)
	]);

	// `target`, not `user`: the infra layout's `user` is the signed-in admin.
	return {
		target: user,
		tab,
		memberships,
		sessions,
		activity: tab === 'activity' ? await listUserActivity(userId, targetId, page) : null,
		emails: tab === 'emails' ? await listUserEmails(userId, targetId, page) : null,
		activitySeries: tab === 'overview' ? await getUserActivitySeries(userId, targetId) : [],
		audit: tab === 'audit' ? await listUserAudit(userId, targetId, page) : null
	};
}
