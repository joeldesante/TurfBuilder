import { render } from 'vitest-browser-svelte';
import { describe, expect, test } from 'vitest';
import InfraSystemPage from './InfraSystemPage.svelte';
import { health, permissions } from './fixtures';

const broken = {
	...health,
	database: { ...health.database, postgisVersion: null },
	status: { ...health.status, migrationNeeded: true, emails24h: { sent: 3, skipped: 0, failed: 4 } }
};

describe('InfraSystemPage', () => {
	test('shows versions, uptime, and database size in plain units', async () => {
		const { getByText } = render(InfraSystemPage, { props: { health, permissions } });

		await expect.element(getByText('v24.9.0')).toBeVisible();
		await expect.element(getByText('1d 2h')).toBeVisible();
		await expect.element(getByText('3.2 GB')).toBeVisible();
	});

	test('lists the largest tables', async () => {
		const { getByRole } = render(InfraSystemPage, { props: { health, permissions } });

		await expect.element(getByRole('table').getByText('universe.org_entity')).toBeVisible();
		await expect.element(getByRole('table').getByText('4,200,000')).toBeVisible();
	});

	test('links a problem to where it is fixed', async () => {
		const { getByRole } = render(InfraSystemPage, { props: { health: broken, permissions } });

		await expect.element(getByRole('link', { name: 'The database needs a migration' })).toHaveAttribute('href', '/infra/migrate');
		await expect.element(getByRole('link', { name: '4 failed emails in 24 hours' })).toBeVisible();
	});

	test('does not link to settings the admin cannot open', async () => {
		const { getByRole, getByText } = render(InfraSystemPage, { props: { health: broken, permissions: ['access'] } });

		await expect.element(getByText('The database needs a migration')).toBeVisible();
		await expect.element(getByRole('link', { name: 'The database needs a migration' })).not.toBeInTheDocument();
	});

	test('says when PostGIS is missing', async () => {
		const { getByText } = render(InfraSystemPage, { props: { health: broken, permissions } });

		await expect.element(getByText('Not installed')).toBeVisible();
	});
});
