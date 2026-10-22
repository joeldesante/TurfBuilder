import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import AuditLogTable from './AuditLogTable.svelte';
import type { AuditEntry } from '$lib/shared/types/audit';

const entry: AuditEntry = {
	id: '2',
	actorId: 'u1',
	actorName: 'Grace Hopper',
	actorEmail: 'grace@example.com',
	action: 'user.suspend',
	targetType: 'user',
	targetId: 'u2',
	metadata: { reason: 'Spam' },
	ip: '203.0.113.1',
	userAgent: null,
	createdAt: '2026-10-18T15:00:00.000Z'
};

test('reads as a sentence with a link to the target', async () => {
	const { getByRole, getByText } = render(AuditLogTable, {
		props: { items: [entry], targetHref: (_t: string, id: string) => `/infra/users/${id}` }
	});

	await expect.element(getByText('Grace Hopper')).toBeVisible();
	await expect.element(getByText('Suspended a user')).toBeVisible();
	await expect.element(getByRole('link', { name: 'View user' })).toHaveAttribute('href', '/infra/users/u2');
});

test('keeps details behind a disclosure', async () => {
	const { getByText } = render(AuditLogTable, { props: { items: [entry] } });

	await expect.element(getByText('reason: Spam')).not.toBeVisible();
	await getByText('Details').click();
	await expect.element(getByText('reason: Spam')).toBeVisible();
	await expect.element(getByText('From 203.0.113.1')).toBeVisible();
});

test('lists each setting change', async () => {
	const { getByText } = render(AuditLogTable, {
		props: {
			items: [{ ...entry, action: 'settings.update', metadata: { changes: [{ key: 'mail.transport', from: 'direct', to: 'ses' }] } }]
		}
	});

	await getByText('Details').click();
	await expect.element(getByText('mail.transport: direct to ses')).toBeVisible();
});

test('names a removed admin', async () => {
	const { getByText } = render(AuditLogTable, { props: { items: [{ ...entry, actorName: null }] } });

	await expect.element(getByText('A removed admin')).toBeVisible();
});
