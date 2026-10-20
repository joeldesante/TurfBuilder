import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraOrgsPage from './InfraOrgsPage.svelte';
import { orgRows, pageOf } from './fixtures';

describe('InfraOrgsPage', () => {
	test('links each org and its owner', async () => {
		const { getByRole } = render(InfraOrgsPage, { props: { page: pageOf(orgRows), filters: {}, onfilter: vi.fn() } });

		await expect.element(getByRole('link', { name: /Riverside Canvass/ })).toHaveAttribute('href', `/infra/orgs/${orgRows[0].id}`);
		await expect.element(getByRole('link', { name: 'Grace Hopper' })).toHaveAttribute('href', `/infra/users/${orgRows[0].owner!.id}`);
		await expect.element(getByRole('table').getByText('Suspended')).toBeVisible();
	});

	test('searches with what was typed', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraOrgsPage, { props: { page: pageOf(orgRows), filters: {}, onfilter } });

		await getByRole('searchbox', { name: 'Search organizations' }).fill('river');
		await getByRole('button', { name: 'Search' }).click();
		expect(onfilter).toHaveBeenCalledWith({ q: 'river', status: undefined, sort: undefined });
	});

	test('sorts as soon as an order is picked', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraOrgsPage, { props: { page: pageOf(orgRows), filters: {}, onfilter } });

		await getByRole('combobox', { name: 'Sort' }).selectOptions('members');
		expect(onfilter).toHaveBeenCalledWith({ q: undefined, status: undefined, sort: 'members' });
	});

	test('says when nothing matches', async () => {
		const { getByText } = render(InfraOrgsPage, { props: { page: pageOf([]), filters: { q: 'zzz' }, onfilter: vi.fn() } });

		await expect.element(getByText('No organizations match.')).toBeVisible();
	});
});
