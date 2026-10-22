import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import InfraOverviewPage from './InfraOverviewPage.svelte';
import { overview, permissions } from './fixtures';

describe('InfraOverviewPage', () => {
	test('reports a healthy platform', async () => {
		const { getByRole } = render(InfraOverviewPage, { props: { overview, permissions } });

		await expect.element(getByRole('heading', { name: 'Everything looks healthy' })).toBeVisible();
	});

	test('lists what needs attention, linking to where it is fixed', async () => {
		const { getByRole } = render(InfraOverviewPage, {
			props: {
				overview: { ...overview, status: { ...overview.status, migrationNeeded: true, failedEmails24h: 4 } },
				permissions
			}
		});

		await expect.element(getByRole('heading', { name: '2 things need attention' })).toBeVisible();
		await expect.element(getByRole('link', { name: 'The database needs a migration' })).toHaveAttribute('href', '/infra/migrate');
		await expect.element(getByRole('link', { name: '4 emails failed in 24 hours' })).toBeVisible();
	});

	test('does not link to settings pages the admin cannot open', async () => {
		const { getByRole, getByText } = render(InfraOverviewPage, {
			props: { overview: { ...overview, status: { ...overview.status, migrationNeeded: true } }, permissions: ['access'] }
		});

		await expect.element(getByText('The database needs a migration')).toBeVisible();
		await expect.element(getByRole('link', { name: 'The database needs a migration' })).not.toBeInTheDocument();
	});

	test('links recent accounts and organizations to their pages', async () => {
		const { getByRole } = render(InfraOverviewPage, { props: { overview, permissions } });

		await expect.element(getByRole('link', { name: /Grace Hopper/ })).toHaveAttribute('href', `/infra/users/${overview.recentUsers[0].id}`);
		await expect.element(getByRole('link', { name: /Riverside Canvass/ })).toHaveAttribute('href', `/infra/orgs/${overview.recentOrgs[0].id}`);
	});

	test('hides the audit section without audit access', async () => {
		const { getByRole } = render(InfraOverviewPage, { props: { overview: { ...overview, recentAudit: null }, permissions: ['access'] } });

		await expect.element(getByRole('heading', { name: 'Recent admin changes' })).not.toBeInTheDocument();
	});

	test('opens external tools in a new tab', async () => {
		const { getByRole } = render(InfraOverviewPage, { props: { overview, permissions } });

		const link = getByRole('link', { name: /Analytics/ });
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
	});
});
