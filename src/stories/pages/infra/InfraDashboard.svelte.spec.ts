import { render } from 'vitest-browser-svelte';
import { expect, test, describe } from 'vitest';
import InfraDashboard from './InfraDashboard.svelte';

describe('InfraDashboard', () => {
	test('shows all granted permissions as pills', async () => {
		const { getByText } = render(InfraDashboard, {
			props: { infraPermissions: ['access', 'users.manage'] }
		});

		await expect.element(getByText('access')).toBeVisible();
		await expect.element(getByText('users.manage')).toBeVisible();
	});

	test('shows available tools for granted permissions', async () => {
		const { getByText } = render(InfraDashboard, {
			props: { infraPermissions: ['access', 'users.manage'] }
		});

		await expect.element(getByText('User Management')).toBeVisible();
	});

	test('shows restricted tools for missing permissions', async () => {
		const { getByText } = render(InfraDashboard, {
			props: { infraPermissions: ['access'] }
		});

		await expect.element(getByText('Overture Data Sync')).toBeVisible();
		await expect.element(getByText('Restricted tools')).toBeVisible();
	});

	test('shows no tools sections when only access permission is granted', async () => {
		const { queryByText } = render(InfraDashboard, {
			props: { infraPermissions: ['access'] }
		});

		await expect.element(queryByText('Tools')).not.toBeInTheDocument();
	});

	test('shows empty state when no permissions', async () => {
		const { getByText } = render(InfraDashboard, {
			props: { infraPermissions: [] }
		});

		await expect.element(getByText('No infrastructure permissions assigned.')).toBeVisible();
	});

	test('available tool links to correct href', async () => {
		const { getByRole } = render(InfraDashboard, {
			props: { infraPermissions: ['access', 'locations.overture_sync'] }
		});

		const link = getByRole('link', { name: /overture data sync/i });
		await expect.element(link).toHaveAttribute('href', '/infra/sync');
	});
});
