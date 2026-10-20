<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AuditLogTable from './AuditLogTable.svelte';
	import type { AuditEntry } from '$lib/shared/types/audit';

	const items: AuditEntry[] = [
		{
			id: '2',
			actorId: 'u1',
			actorName: 'Grace Hopper',
			actorEmail: 'grace@example.com',
			action: 'user.suspend',
			targetType: 'user',
			targetId: 'u2',
			metadata: { reason: 'Sending spam invites', expiresAt: null },
			ip: '203.0.113.1',
			userAgent: null,
			createdAt: '2026-10-18T15:00:00.000Z'
		},
		{
			id: '1',
			actorId: 'u1',
			actorName: 'Grace Hopper',
			actorEmail: 'grace@example.com',
			action: 'settings.update',
			targetType: 'setting',
			targetId: null,
			metadata: { changes: [{ key: 'mail.transport', from: 'direct', to: 'ses' }] },
			ip: '203.0.113.1',
			userAgent: null,
			createdAt: '2026-10-17T09:00:00.000Z'
		}
	];

	const { Story } = defineMeta({
		title: 'Components/Data Display/AuditLogTable',
		component: AuditLogTable,
		tags: ['autodocs'],
		parameters: {
			docs: { subtitle: 'Changes infrastructure admins made, newest first, with their details tucked behind a disclosure.' }
		}
	});
</script>

<Story
	name="Audit log"
	args={{
		items,
		targetHref: (type: string, id: string) => (type === 'user' ? `/infra/users/${id}` : null)
	}}
/>

<Story name="On a target page" args={{ items, showTarget: false }} />

<Story name="Empty" args={{ items: [] }} />
