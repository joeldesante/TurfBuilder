import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraUsersPage from './InfraUsersPage.svelte';
import { pageOf, userRows } from './fixtures';

describe('InfraUsersPage', () => {
	test('links each user to their page and shows their status', async () => {
		const { getByRole } = render(InfraUsersPage, {
			props: { page: pageOf(userRows, 100), filters: {}, onfilter: vi.fn() }
		});

		await expect.element(getByRole('link', { name: /Alan Turing/ })).toHaveAttribute('href', `/infra/users/${userRows[1].id}`);
		const table = getByRole('table');
		await expect.element(table.getByText('Suspended')).toBeVisible();
		await expect.element(table.getByText('Unverified')).toBeVisible();
	});

	test('searches with what was typed', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraUsersPage, { props: { page: pageOf(userRows, 100), filters: {}, onfilter } });

		await getByRole('searchbox', { name: 'Search users' }).fill('grace');
		await getByRole('button', { name: 'Search' }).click();

		expect(onfilter).toHaveBeenCalledWith({ q: 'grace', status: undefined, sort: undefined });
	});

	test('filters as soon as a status is picked', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraUsersPage, { props: { page: pageOf(userRows, 100), filters: {}, onfilter } });

		await getByRole('combobox', { name: 'Show' }).selectOptions('suspended');

		expect(onfilter).toHaveBeenCalledWith({ q: undefined, status: 'suspended', sort: undefined });
	});

	test('offers to clear filters when nothing matches', async () => {
		const onfilter = vi.fn();
		const { getByRole, getByText } = render(InfraUsersPage, {
			props: { page: pageOf([], 100), filters: { q: 'zzz' }, onfilter }
		});

		await expect.element(getByText('No users match.')).toBeVisible();
		await getByRole('button', { name: 'Clear filters' }).click();
		expect(onfilter).toHaveBeenCalledWith({});
	});
});
