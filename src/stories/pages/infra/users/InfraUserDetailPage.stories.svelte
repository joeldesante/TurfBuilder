<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraUserDetailPage from './InfraUserDetailPage.svelte';
	import { activity, auditEntries, emails, memberships, pageOf, sessions, userDetail } from './fixtures';
	import { INFRA_PERMISSIONS } from '$lib/shared/types/infra';

	const done = async () => {};
	const actions = {
		update: done,
		sendPasswordReset: done,
		sendVerification: done,
		resetTwoFactor: done,
		suspend: done,
		unsuspend: done,
		revokeSessions: done,
		revokeSession: done,
		impersonate: done,
		remove: done
	};

	const base = {
		user: userDetail,
		memberships,
		sessions,
		permissions: [...INFRA_PERMISSIONS],
		currentUserId: 'someone-else',
		actions
	};

	const { Story } = defineMeta({
		title: 'Pages/Infra/User',
		component: InfraUserDetailPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle:
					'One account: its organizations, sessions, activity, emails, and the changes admins made, with the actions an infrastructure admin can take.'
			}
		}
	});
</script>

<Story name="Overview" args={{ ...base, tab: 'overview' }} />

<Story name="Organizations" args={{ ...base, tab: 'organizations' }} />

<Story name="Sessions" args={{ ...base, tab: 'sessions' }} />

<Story name="Activity" args={{ ...base, tab: 'activity', activity: pageOf(activity) }} />

<Story name="Emails" args={{ ...base, tab: 'emails', emails: pageOf(emails) }} />

<Story name="Audit" args={{ ...base, tab: 'audit', audit: pageOf(auditEntries) }} />

<Story
	name="Suspended"
	args={{
		...base,
		tab: 'overview',
		user: { ...userDetail, suspended: true, suspendedReason: 'Sending spam invites', suspendedUntil: '2026-11-01T00:00:00.000Z' }
	}}
/>

<Story name="Read-only admin" args={{ ...base, tab: 'overview', permissions: ['access'] }} />
