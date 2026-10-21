import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraSettingsPage from './InfraSettingsPage.svelte';
import { credentials, settings } from './fixtures';

function props(overrides: Record<string, unknown> = {}) {
	return {
		settings,
		credentials,
		tab: 'general' as const,
		onsave: vi.fn(async () => ({ ok: true as const, restartRequired: false })),
		ontestmail: vi.fn(async () => 'Sent a test email to you@example.com.'),
		onteststorage: vi.fn(async () => 'The bucket accepted a test file.'),
		...overrides
	};
}

describe('InfraSettingsPage', () => {
	test('shows only the fields of the open tab', async () => {
		const { getByRole } = render(InfraSettingsPage, { props: props({ tab: 'storage' }) });

		await expect.element(getByRole('textbox', { name: 'Bucket' })).toBeVisible();
		await expect.element(getByRole('textbox', { name: 'Application name' })).not.toBeInTheDocument();
	});

	test('saves nothing until something changes', async () => {
		const { getByRole } = render(InfraSettingsPage, { props: props() });

		await expect.element(getByRole('button', { name: 'Save changes' })).toBeDisabled();
	});

	test('sends only the changed values', async () => {
		const p = props();
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('textbox', { name: 'Application name' }).fill('Acme Canvass');
		await getByRole('button', { name: 'Save changes' }).click();

		expect(p.onsave).toHaveBeenCalledWith({ application_name: 'Acme Canvass' });
		await expect.element(getByRole('status')).toHaveTextContent('Saved.');
	});

	test('tells the admin when a restart is needed', async () => {
		const p = props({ onsave: vi.fn(async () => ({ ok: true as const, restartRequired: true })) });
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('textbox', { name: 'Application name' }).fill('Acme');
		await getByRole('button', { name: 'Save changes' }).click();

		await expect.element(getByRole('status')).toHaveTextContent('Restart the app');
	});

	test('shows a field error where it belongs and keeps the edit', async () => {
		const p = props({
			tab: 'email',
			onsave: vi.fn(async () => ({ ok: false as const, message: 'Enter a domain such as mail.example.com.', errors: { 'mail.domain': 'Enter a domain such as mail.example.com.' } }))
		});
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('textbox', { name: 'Sending domain' }).fill('not a domain');
		await getByRole('button', { name: 'Save changes' }).click();

		await expect.element(getByRole('textbox', { name: 'Sending domain' })).toHaveValue('not a domain');
		await expect.element(getByRole('alert').first()).toHaveTextContent('Enter a domain');
	});

	test('drops unsaved edits when the tab changes, so they are not saved unseen', async () => {
		const p = props();
		const screen = render(InfraSettingsPage, { props: p });

		await screen.getByRole('textbox', { name: 'Application name' }).fill('Not saved');
		await screen.rerender({ ...p, tab: 'email' });
		await screen.getByRole('textbox', { name: 'Sending domain' }).fill('mail.example.com');
		await screen.getByRole('button', { name: 'Save changes' }).click();

		expect(p.onsave).toHaveBeenCalledWith({ 'mail.domain': 'mail.example.com' });
	});

	test('discards edits', async () => {
		const { getByRole } = render(InfraSettingsPage, { props: props() });

		await getByRole('textbox', { name: 'Application name' }).fill('Changed');
		await getByRole('button', { name: 'Discard' }).click();

		await expect.element(getByRole('textbox', { name: 'Application name' })).toHaveValue('TurfBuilder');
	});

	test('toggles a boolean setting', async () => {
		const p = props({ tab: 'organizations' });
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('switch', { name: 'Anyone can create an organization' }).click();
		await getByRole('button', { name: 'Save changes' }).click();

		expect(p.onsave).toHaveBeenCalledWith({ 'organizations.allow_creation': 'false' });
	});

	test('edits the external links as rows', async () => {
		const p = props({ tab: 'links' });
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('button', { name: 'Add a link' }).click();
		await getByRole('textbox', { name: 'Link 1 label' }).fill('Grafana');
		await getByRole('textbox', { name: 'Link 1 address' }).fill('https://grafana.example.com');
		await getByRole('button', { name: 'Save changes' }).click();

		expect(p.onsave).toHaveBeenCalledWith({ 'links.custom': JSON.stringify([{ label: 'Grafana', url: 'https://grafana.example.com' }]) });
	});

	test('reports whether credentials exist without showing them, and runs the tests', async () => {
		const p = props({ tab: 'email' });
		const { getByRole, getByText } = render(InfraSettingsPage, { props: p });

		await expect.element(getByText(/AWS_ACCESS_KEY_ID.*not set/)).toBeVisible();
		await getByRole('button', { name: 'Send a test email to me' }).click();
		await expect.element(getByRole('status')).toHaveTextContent('Sent a test email to you@example.com.');
		expect(p.ontestmail).toHaveBeenCalled();
	});

	test('shows a failed storage test as an alert', async () => {
		const p = props({ tab: 'storage', onteststorage: vi.fn(async () => { throw new Error('The bucket could not be reached.'); }) });
		const { getByRole } = render(InfraSettingsPage, { props: p });

		await getByRole('button', { name: 'Test connection' }).click();

		await expect.element(getByRole('alert')).toHaveTextContent('The bucket could not be reached.');
	});
});
