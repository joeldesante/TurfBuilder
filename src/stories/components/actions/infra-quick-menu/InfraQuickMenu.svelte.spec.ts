import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import InfraQuickMenu from './InfraQuickMenu.svelte';
import { buildInfraNav } from '$lib/shared/utils/infra-nav';
import { INFRA_PERMISSIONS } from '$lib/shared/types/infra';

const everything = buildInfraNav([...INFRA_PERMISSIONS], [{ label: 'Analytics', url: 'https://analytics.example.com' }]);

describe('InfraQuickMenu', () => {
	test('is closed until the button is pressed', async () => {
		render(InfraQuickMenu, { props: { groups: everything } });

		await expect.element(page.getByRole('link', { name: 'Users' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Infrastructure menu' }).click();
		await expect.element(page.getByRole('link', { name: 'Users', exact: true })).toHaveAttribute('href', '/infra/users');
	});

	test('lists only the pages the admin can open', async () => {
		render(InfraQuickMenu, { props: { groups: buildInfraNav(['access']), open: true } });

		await expect.element(page.getByRole('link', { name: 'Overview' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Migrate' })).not.toBeInTheDocument();
	});

	test('opens external tools in a new tab', async () => {
		render(InfraQuickMenu, { props: { groups: everything, open: true } });

		const link = page.getByRole('link', { name: /Analytics/ });
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	test('offers to find users and organizations by what was typed', async () => {
		render(InfraQuickMenu, { props: { groups: everything, open: true } });

		await page.getByPlaceholder('Find a user or organization').fill('ada lovelace');
		await expect
			.element(page.getByRole('link', { name: 'Users matching "ada lovelace"' }))
			.toHaveAttribute('href', '/infra/users?q=ada%20lovelace');
		await expect
			.element(page.getByRole('link', { name: 'Organizations matching "ada lovelace"' }))
			.toHaveAttribute('href', '/infra/orgs?q=ada%20lovelace');
	});

	test('links to the organization being viewed', async () => {
		render(InfraQuickMenu, {
			props: { groups: everything, open: true, currentOrg: { id: 'org-1', name: 'Riverside' } }
		});

		await expect
			.element(page.getByRole('link', { name: 'Open Riverside in infra' }))
			.toHaveAttribute('href', '/infra/orgs/org-1');
	});

	test('Alt+I toggles the menu', async () => {
		render(InfraQuickMenu, { props: { groups: everything } });

		await userEvent.keyboard('{Alt>}i{/Alt}');
		await expect.element(page.getByRole('link', { name: 'Overview' })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('link', { name: 'Overview' })).not.toBeInTheDocument();
	});
});
