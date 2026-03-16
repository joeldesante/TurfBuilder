import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import RoleDetailPage from './RoleDetailPage.svelte';

const baseRole = {
	id: 'r1',
	name: 'Member',
	is_owner: false,
	is_default: false,
	permissions: ['survey:read']
};

const ownerRole = {
	id: 'r-owner',
	name: 'Owner',
	is_owner: true,
	is_default: false,
	permissions: null
};

const members = [
	{ id: 'u1', name: 'Alice', email: 'alice@example.com', role_id: 'r1', role_name: 'Member' },
	{ id: 'u2', name: 'Bob', email: 'bob@example.com', role_id: null, role_name: null }
];

const baseProps = {
	role: baseRole,
	members,
	rolesHref: '/settings/roles',
	onSavePermissions: vi.fn(),
	onSaveName: vi.fn(),
	onAssignRole: vi.fn()
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

	describe('role settings section (non-owner)', () => {
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

	describe('owner role', () => {
		it('shows owner description instead of permission editor', async () => {
			render(RoleDetailPage, { ...baseProps, role: ownerRole });
			await expect
				.element(page.getByText('Owner role — has all permissions by default.'))
				.toBeVisible();
		});

		it('hides the Save button for owner role', async () => {
			render(RoleDetailPage, { ...baseProps, role: ownerRole });
			await expect.element(page.getByRole('button', { name: 'Save' })).not.toBeInTheDocument();
		});
	});

	describe('members section', () => {
		it('renders member names', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByText('Alice')).toBeVisible();
			await expect.element(page.getByText('Bob')).toBeVisible();
		});

		it('shows Remove for members already assigned to this role', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Remove' })).toBeVisible();
		});

		it('shows Assign for members not assigned to this role', async () => {
			render(RoleDetailPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Assign' })).toBeVisible();
		});

		it('calls onAssignRole with null when Remove is clicked', async () => {
			const onAssignRole = vi.fn().mockResolvedValue(undefined);
			render(RoleDetailPage, { ...baseProps, onAssignRole });
			await page.getByRole('button', { name: 'Remove' }).click();
			expect(onAssignRole).toHaveBeenCalledWith('u1', null);
		});

		it('calls onAssignRole with the role id when Assign is clicked', async () => {
			const onAssignRole = vi.fn().mockResolvedValue(undefined);
			render(RoleDetailPage, { ...baseProps, onAssignRole });
			await page.getByRole('button', { name: 'Assign' }).click();
			expect(onAssignRole).toHaveBeenCalledWith('u2', 'r1');
		});
	});
});
