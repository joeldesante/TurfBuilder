import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraAdminsPage from './InfraAdminsPage.svelte';
import { admins, candidates, roles } from './fixtures';

function props(overrides: Record<string, unknown> = {}) {
	return {
		admins,
		roles,
		currentUserId: admins[0].id,
		onsearch: vi.fn(async () => candidates),
		ongrant: vi.fn(async () => {}),
		onrevoke: vi.fn(async () => {}),
		...overrides
	};
}

describe('InfraAdminsPage', () => {
	test('describes each role in words, not permission keys', async () => {
		const { getByText } = render(InfraAdminsPage, { props: props() });

		await expect.element(getByText('Impersonate users')).toBeVisible();
		await expect.element(getByText('access', { exact: true })).not.toBeInTheDocument();
	});

	test('marks the viewing admin and those who can manage admins', async () => {
		const { getByText } = render(InfraAdminsPage, { props: props() });

		await expect.element(getByText('(you)')).toBeVisible();
		await expect.element(getByText('Can manage admins')).toBeVisible();
	});

	test('removes a role only after confirming', async () => {
		const p = props();
		const { getByRole } = render(InfraAdminsPage, { props: p });

		await getByRole('button', { name: 'Remove Support from Ada Lovelace' }).click();
		expect(p.onrevoke).not.toHaveBeenCalled();
		await getByRole('dialog').getByRole('button', { name: 'Remove role' }).click();

		expect(p.onrevoke).toHaveBeenCalledWith(admins[1].id, roles[1].id);
	});

	test('shows why a removal was refused and keeps the dialog open', async () => {
		const p = props({ onrevoke: vi.fn(async () => { throw new Error('This is the last infrastructure admin who can manage users.'); }) });
		const { getByRole } = render(InfraAdminsPage, { props: p });

		await getByRole('button', { name: /Remove Infrastructure Administrator from Grace Hopper/ }).click();
		await getByRole('dialog').getByRole('button', { name: 'Remove role' }).click();

		await expect.element(getByRole('dialog').getByText(/last infrastructure admin/)).toBeVisible();
	});

	test('finds a user, chooses a role, and grants it', async () => {
		const p = props();
		const { getByRole } = render(InfraAdminsPage, { props: p });

		await getByRole('searchbox', { name: 'Find a user' }).fill('katherine');
		await getByRole('button', { name: 'Search' }).click();
		expect(p.onsearch).toHaveBeenCalledWith('katherine');

		await getByRole('button', { name: 'Choose Katherine Johnson' }).click();
		await getByRole('combobox', { name: /Role for Katherine Johnson/ }).selectOptions(roles[1].id);
		await getByRole('button', { name: 'Give role' }).click();

		expect(p.ongrant).toHaveBeenCalledWith(candidates[0].id, roles[1].id);
	});

	test('asks for a role before granting', async () => {
		const p = props();
		const { getByRole } = render(InfraAdminsPage, { props: p });

		await getByRole('searchbox', { name: 'Find a user' }).fill('kat');
		await getByRole('button', { name: 'Search' }).click();
		await getByRole('button', { name: 'Choose Katherine Johnson' }).click();
		await getByRole('button', { name: 'Give role' }).click();

		await expect.element(getByRole('alert')).toHaveTextContent('Choose a role.');
		expect(p.ongrant).not.toHaveBeenCalled();
	});

	test('says so when the search finds no one', async () => {
		const { getByRole, getByText } = render(InfraAdminsPage, { props: props({ onsearch: vi.fn(async () => []) }) });

		await getByRole('searchbox', { name: 'Find a user' }).fill('zzz');
		await getByRole('button', { name: 'Search' }).click();

		await expect.element(getByText('No one matches.')).toBeVisible();
	});
});
