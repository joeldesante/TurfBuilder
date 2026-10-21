<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraOrgDetailPage from './InfraOrgDetailPage.svelte';
	import { orgDetail, members, invitations, inviteLinks, pageOf } from './fixtures';
	import { wave } from '$components/data-display/charts/fixtures';

	const activitySeries = [
		{ key: 'visits', label: 'Visits', points: wave(13, 220, 60, 1) },
		{ key: 'active', label: 'Active members', points: wave(13, 40, 10, 2) }
	];
	const actions = {
		suspend: async () => {},
		unsuspend: async () => {},
		transferOwnership: async () => {},
		searchMembers: async () => members.map((m) => ({ memberId: m.memberId, name: m.name, email: m.email, memberRole: m.memberRole })),
		remove: async () => {},
		restore: async () => {},
		removeMember: async () => {},
		cancelInvitation: async () => {},
		revokeLink: async () => {}
	};
	const permissions = ['access', 'orgs.manage', 'audit.read'];

	const { Story } = defineMeta({
		title: 'Pages/Infra/Organization detail',
		component: InfraOrgDetailPage,
		tags: ['autodocs'],
		args: { org: orgDetail, tab: 'overview', members: pageOf(members), activitySeries, permissions, actions },
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'One organization as an infrastructure admin sees it: who runs it, how active it is, and what can be done to it.' }
		}
	});
</script>

<Story name="Overview" />

<Story name="Members" args={{ tab: 'members' }} />

<Story name="Invitations" args={{ tab: 'invitations', invitations: { invitations, links: inviteLinks } }} />

<Story
	name="Suspended"
	args={{ org: { ...orgDetail, suspended: true, suspendedAt: '2026-10-01T10:00:00.000Z', suspendedReason: 'Reported for spam.' } }}
/>

<Story name="Deleted" args={{ org: { ...orgDetail, deleted: true, deletedAt: '2026-10-05T10:00:00.000Z' } }} />

<Story name="Read only" args={{ permissions: ['access'] }} />
