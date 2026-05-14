import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import InfraEmailPage from './InfraEmailPage.svelte';

const defaultSettings = [
	{ key: 'mail.transport', value: 'direct', description: 'The mail transport used to send outgoing emails.' },
	{ key: 'mail.domain', value: '', description: 'The domain from which outgoing emails are sent.' }
];

test('renders transport and domain fields', async () => {
	const { getByText } = render(InfraEmailPage, {
		props: { settings: defaultSettings, onSave: vi.fn() }
	});
	await expect.element(getByText('Mail Transport')).toBeVisible();
	await expect.element(getByText('Email Domain')).toBeVisible();
});

test('calls onSave with correct key when domain save button clicked', async () => {
	const onSave = vi.fn().mockResolvedValue(undefined);
	const { getByPlaceholder, getByRole } = render(InfraEmailPage, {
		props: { settings: defaultSettings, onSave }
	});

	const input = getByPlaceholder('mail.example.com');
	await input.fill('mail.myapp.com');

	const buttons = getByRole('button', { name: 'Save' });
	await buttons.last().click();

	expect(onSave).toHaveBeenCalledWith('mail.domain', 'mail.myapp.com');
});
