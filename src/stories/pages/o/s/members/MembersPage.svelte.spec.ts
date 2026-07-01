import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import MembersPage from './MembersPage.svelte';

const sampleMembers = [
	{ id: '1', name: 'Alice Johnson', email: 'alice@example.com', role_id: 'r1', role_name: 'Owner' },
	{ id: '2', name: 'Bob Smith', email: 'bob@example.com', role_id: 'r2', role_name: 'Member' },
	{ id: '3', name: 'Carol White', email: 'carol@example.com', role_id: null, role_name: null }
];

const baseProps = {
	members: sampleMembers,
	canRemoveMembers: false,
	isOwner: false,
	inviteLinks: [],
	slugInviteEnabled: false,
	orgSlug: 'test-org',
	onRemove: vi.fn(),
	onCreateLink: vi.fn(),
	onRevokeLink: vi.fn(),
	onToggleSlugInvite: vi.fn()
};

describe('MembersPage', () => {
	it('renders the page heading', async () => {
		render(MembersPage, baseProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Members');
	});

	it('renders each member name and email', async () => {
		render(MembersPage, baseProps);
		await expect.element(page.getByText('Alice Johnson')).toBeVisible();
		await expect.element(page.getByText('alice@example.com')).toBeVisible();
		await expect.element(page.getByText('Bob Smith')).toBeVisible();
	});

	it('renders member role names', async () => {
		render(MembersPage, baseProps);
		await expect.element(page.getByText('Owner')).toBeVisible();
		await expect.element(page.getByText('Member')).toBeVisible();
	});

	it('shows empty state when no members', async () => {
		render(MembersPage, { ...baseProps, members: [] });
		await expect.element(page.getByText('No members yet.')).toBeVisible();
	});

	it('shows remove buttons when canRemoveMembers is true', async () => {
		render(MembersPage, { ...baseProps, canRemoveMembers: true });
		const removeButtons = page.getByRole('button', { name: 'Remove member' });
		await expect.element(removeButtons.first()).toBeVisible();
	});

	it('hides remove buttons when canRemoveMembers is false', async () => {
		render(MembersPage, baseProps);
		await expect
			.element(page.getByRole('button', { name: 'Remove member' }))
			.not.toBeInTheDocument();
	});

	it('calls onRemove with the correct user id', async () => {
		const onRemove = vi.fn().mockResolvedValue(undefined);
		render(MembersPage, { ...baseProps, canRemoveMembers: true, onRemove });
		await page.getByRole('button', { name: 'Remove member' }).first().click();
		expect(onRemove).toHaveBeenCalledWith(sampleMembers[0].id);
	});

	it('shows InviteLinksSection when isOwner is true', async () => {
		render(MembersPage, { ...baseProps, isOwner: true });
		await expect.element(page.getByRole('heading', { name: 'Invite Links' })).toBeVisible();
	});

	it('hides InviteLinksSection when isOwner is false', async () => {
		render(MembersPage, baseProps);
		await expect
			.element(page.getByRole('heading', { name: 'Invite Links' }))
			.not.toBeInTheDocument();
	});
});
