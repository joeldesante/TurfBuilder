import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import EmailLogTable from './EmailLogTable.svelte';
import type { EmailLogEntry } from '$lib/shared/types/activity';

const failed: EmailLogEntry = {
	id: '1',
	recipient: 'grace@example.com',
	template: 'auth.verify_email',
	subject: 'Verify your email address',
	status: 'failed',
	error: 'Connection timed out',
	createdAt: '2026-10-16T09:00:00.000Z'
};

test('shows the subject, status, and error', async () => {
	const { getByText } = render(EmailLogTable, { props: { items: [failed] } });

	await expect.element(getByText('Verify your email address')).toBeVisible();
	await expect.element(getByText('Failed')).toBeVisible();
	await expect.element(getByText('Connection timed out')).toBeVisible();
	await expect.element(getByText('grace@example.com')).toBeVisible();
});

test('can leave out the recipient', async () => {
	const { getByText, getByRole } = render(EmailLogTable, { props: { items: [failed], showRecipient: false } });

	await expect.element(getByText('grace@example.com')).not.toBeInTheDocument();
	await expect.element(getByRole('columnheader', { name: 'To' })).not.toBeInTheDocument();
});

test('says so when there is nothing', async () => {
	const { getByText } = render(EmailLogTable, { props: { items: [] } });

	await expect.element(getByText('No emails sent.')).toBeVisible();
});
