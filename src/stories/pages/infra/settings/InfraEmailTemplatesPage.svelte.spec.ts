import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import InfraEmailTemplatesPage from './InfraEmailTemplatesPage.svelte';
import { templates } from './fixtures';

describe('InfraEmailTemplatesPage', () => {
	test('links each template to its editor', async () => {
		const { getByRole } = render(InfraEmailTemplatesPage, { props: { templates } });

		await expect.element(getByRole('link', { name: /Reset password/ })).toHaveAttribute('href', '/infra/settings/email/templates/auth.reset_password');
	});

	test('marks edited templates and leaves the others as default', async () => {
		const { getByRole } = render(InfraEmailTemplatesPage, { props: { templates } });

		await expect.element(getByRole('link', { name: /Reset password/ }).getByText('Edited')).toBeVisible();
		await expect.element(getByRole('link', { name: /Verify email address/ }).getByText('Default')).toBeVisible();
	});

	test('says so when there are none', async () => {
		const { getByText } = render(InfraEmailTemplatesPage, { props: { templates: [] } });

		await expect.element(getByText(/No email templates yet/)).toBeVisible();
	});
});
