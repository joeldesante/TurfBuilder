<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ActivityFeed from './ActivityFeed.svelte';
	import type { ActivityEntry } from '$lib/shared/types/activity';

	const items: ActivityEntry[] = [
		{
			id: '3',
			type: 'canvass.visit',
			label: 'Visited a location',
			userId: 'u1',
			userName: 'Grace Hopper',
			orgId: 'o1',
			orgName: 'Riverside Canvass',
			metadata: { contact_made: true },
			occurredAt: '2026-10-18T15:00:00.000Z'
		},
		{
			id: '2',
			type: 'member.joined',
			label: 'Joined an organization',
			userId: 'u2',
			userName: 'Alan Turing',
			orgId: 'o1',
			orgName: 'Riverside Canvass',
			metadata: {},
			occurredAt: '2026-10-17T09:30:00.000Z'
		},
		{
			id: '1',
			type: 'user.signed_up',
			label: 'Signed up',
			userId: 'u2',
			userName: 'Alan Turing',
			orgId: null,
			orgName: null,
			metadata: {},
			occurredAt: '2026-10-17T09:00:00.000Z'
		}
	];

	const { Story } = defineMeta({
		title: 'Components/Data Display/ActivityFeed',
		component: ActivityFeed,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle: 'A timeline of activity events, newest first. Turn off the person or organization when the page is already about one.'
			}
		}
	});
</script>

<Story name="Platform-wide" args={{ items, userHref: (id: string) => `/infra/users/${id}`, orgHref: (id: string) => `/infra/orgs/${id}` }} />

<Story name="On a user page" args={{ items, showUser: false }} />

<Story name="Empty" args={{ items: [] }} />
