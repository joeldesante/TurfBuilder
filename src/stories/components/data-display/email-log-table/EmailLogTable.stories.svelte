<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EmailLogTable from './EmailLogTable.svelte';
	import type { EmailLogEntry } from '$lib/shared/types/activity';

	const items: EmailLogEntry[] = [
		{
			id: '3',
			recipient: 'alan@example.com',
			template: 'auth.reset_password',
			subject: 'Reset your password',
			status: 'sent',
			error: null,
			createdAt: '2026-10-18T15:00:00.000Z'
		},
		{
			id: '2',
			recipient: 'ada@example.com',
			template: 'auth.verify_email',
			subject: 'Verify your email address',
			status: 'skipped',
			error: 'Mail is not configured.',
			createdAt: '2026-10-17T09:00:00.000Z'
		},
		{
			id: '1',
			recipient: 'grace@example.com',
			template: 'auth.verify_email',
			subject: 'Verify your email address',
			status: 'failed',
			error: 'Connection timed out',
			createdAt: '2026-10-16T09:00:00.000Z'
		}
	];

	const { Story } = defineMeta({
		title: 'Components/Data Display/EmailLogTable',
		component: EmailLogTable,
		tags: ['autodocs'],
		parameters: { docs: { subtitle: 'Every email the app tried to send, and whether it went out.' } }
	});
</script>

<Story name="Email log" args={{ items }} />

<Story name="On a user page" args={{ items, showRecipient: false }} />

<Story name="Empty" args={{ items: [] }} />
