import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import RolesPage from './RolesPage.svelte';

const roles = [
	{ id: 'r1', name: 'Owner', is_owner: true, is_default: false, permissions: null },
	{ id: 'r2', name: 'Member', is_owner: false, is_default: true, permissions: ['survey:read'] },
	{ id: 'r3', name: 'Volunteer', is_owner: false, is_default: false, permissions: [] }
];

const baseProps = {
	roles,
	roleDetailHref: (id: string) => `/roles/${id}`,
	onCreate: vi.fn(),
	onDelete: vi.fn()
};

describe('RolesPage', () => {
	describe('rendering', () => {
		it('renders the Roles heading', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Roles');
		});

		it('renders each role name', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByText('Owner')).toBeVisible();
			await expect.element(page.getByText('Member')).toBeVisible();
			await expect.element(page.getByText('Volunteer')).toBeVisible();
		});

		it('renders links to role detail pages', async () => {
			render(RolesPage, baseProps);
			const ownerLink = page.getByRole('link', { name: /Owner/ });
			await expect.element(ownerLink).toBeVisible();
			expect(ownerLink.element().getAttribute('href')).toBe('/roles/r1');
		});

		it('shows "All permissions" for owner roles', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByText('All permissions')).toBeVisible();
		});

		it('shows permission count for non-owner roles', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByText('1')).toBeVisible(); // Member has 1 permission
		});

		it('shows Default=Yes for the default role', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByText('Yes')).toBeVisible();
		});
	});

	describe('delete button', () => {
		it('does not render delete button for owner role', async () => {
			render(RolesPage, baseProps);
			const deleteButtons = page.getByRole('button', { name: 'Delete role' });
			// Only Volunteer (non-owner, non-default) should have delete
			expect((await deleteButtons.all()).length).toBe(1);
		});

		it('calls onDelete with the role id when delete is clicked', async () => {
			const onDelete = vi.fn().mockResolvedValue(undefined);
			render(RolesPage, { ...baseProps, onDelete });
			await page.getByRole('button', { name: 'Delete role' }).click();
			expect(onDelete).toHaveBeenCalledWith('r3');
		});
	});

	describe('create role form', () => {
		it('renders the role name input', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByPlaceholder('Role name')).toBeVisible();
		});

		it('renders the Create button', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Create' })).toBeVisible();
		});

		it('disables the Create button when input is empty', async () => {
			render(RolesPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Create' })).toBeDisabled();
		});

		it('calls onCreate with the trimmed name on click', async () => {
			const onCreate = vi.fn().mockResolvedValue(undefined);
			render(RolesPage, { ...baseProps, onCreate });
			await page.getByPlaceholder('Role name').fill('Canvasser');
			await page.getByRole('button', { name: 'Create' }).click();
			expect(onCreate).toHaveBeenCalledWith('Canvasser');
		});

		it('shows error message when onCreate rejects', async () => {
			const onCreate = vi.fn().mockRejectedValue(new Error('Name already taken'));
			render(RolesPage, { ...baseProps, onCreate });
			await page.getByPlaceholder('Role name').fill('Duplicate');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect.element(page.getByText('Name already taken')).toBeVisible();
		});
	});
});
