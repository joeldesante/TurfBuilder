import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import RoleDetailPage from './RoleDetailPage.svelte';

const baseRole = {
	id: 'r1',
	name: 'Member',
	is_default: false,
	is_admin: false,
	permissions: ['survey.read']
};

const adminRole = {
	id: 'r-admin',
	name: 'Admin',
	is_default: false,
	is_admin: true,
	permissions: ['system.access']
};

const baseProps = {
	role: baseRole,
	rolesHref: '/settings/roles',
	onSavePermissions: vi.fn(),
	onSaveName: vi.fn()
};

describe('RoleDetailPage', () => {
	describe('role name header', () => {
		it('renders the role name as page title', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Member');
		});

		it('renders a breadcrumb link back to Roles', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByRole('link', { name: 'Roles' })).toBeVisible();
		});
	});

	describe('role settings section', () => {
		it('shows the role name input', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByLabelText('Name')).toBeVisible();
		});

		it('populates the input with the role name', async () => {
			render(RoleDetailPage, baseProps);
			const input = page.getByLabelText('Name');
			await expect.element(input).toHaveValue('Member');
		});

		it('renders the Save button', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible();
		});

		it('renders permission toggles', async () => {
			render(RoleDetailPage, baseProps);
			// Permissions section should have switch toggles
			const switches = page.getByRole('switch');
			await expect.element(switches.first()).toBeVisible();
		});

		it('calls onSaveName when Save is clicked', async () => {
			const onSaveName = vi.fn().mockResolvedValue(undefined);
			render(RoleDetailPage, { ...baseProps, onSaveName });
			await page.getByRole('button', { name: 'Save' }).click();
			expect(onSaveName).toHaveBeenCalledWith('Member');
		});
	});

	describe('admin role', () => {
		it('shows the Default role subheading when the admin role is also the default role', async () => {
			render(RoleDetailPage, { ...baseProps, role: { ...adminRole, is_default: true } });
			await expect
				.element(page.getByText('Default role — automatically assigned to all new members.'))
				.toBeVisible();
		});

		it('locks the system.access toggle for the admin role', async () => {
			render(RoleDetailPage, { ...baseProps, role: adminRole });
			// system.access is the first permission rendered, and is locked on for admin roles.
			const switches = page.getByRole('switch');
			await expect.element(switches.first()).toBeDisabled();
		});
	});
});
