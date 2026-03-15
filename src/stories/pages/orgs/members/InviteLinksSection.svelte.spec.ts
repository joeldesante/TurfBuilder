import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import InviteLinksSection from './InviteLinksSection.svelte';

const sampleLinks = [
	{ id: 'V1StGXR8_Z5jdHi6B-myT', created_at: '2026-03-01T00:00:00Z', expires_at: null },
	{
		id: 'abc123xyz_DEFGH456789',
		created_at: '2026-03-10T00:00:00Z',
		expires_at: '2026-04-10T00:00:00Z'
	}
];

const defaultProps = {
	inviteLinks: sampleLinks,
	slugInviteEnabled: false,
	orgSlug: 'test-org',
	onCreate: vi.fn(),
	onRevoke: vi.fn(),
	onToggleSlug: vi.fn()
};

describe('InviteLinksSection', () => {
	it('renders the section heading', async () => {
		render(InviteLinksSection, defaultProps);
		await expect.element(page.getByRole('heading', { name: 'Invite Links' })).toBeVisible();
	});

	it('renders each invite link token', async () => {
		render(InviteLinksSection, defaultProps);
		await expect.element(page.getByText('V1StGXR8_Z5jdHi6B-myT')).toBeVisible();
		await expect.element(page.getByText('abc123xyz_DEFGH456789')).toBeVisible();
	});

	it('shows "Never" for links with no expiry', async () => {
		render(InviteLinksSection, defaultProps);
		await expect.element(page.getByText('Never')).toBeVisible();
	});

	it('renders revoke buttons for each link', async () => {
		render(InviteLinksSection, defaultProps);
		const revokeButtons = page.getByRole('button', { name: 'Revoke link' });
		await expect.element(revokeButtons.first()).toBeVisible();
	});

	it('calls onRevoke with the correct id when revoke is clicked', async () => {
		const onRevoke = vi.fn().mockResolvedValue(undefined);
		render(InviteLinksSection, { ...defaultProps, onRevoke });
		await page.getByRole('button', { name: 'Revoke link' }).first().click();
		expect(onRevoke).toHaveBeenCalledWith(sampleLinks[0].id);
	});

	it('shows copy buttons for each link', async () => {
		render(InviteLinksSection, defaultProps);
		const copyButtons = page.getByRole('button', { name: 'Copy invite link' });
		await expect.element(copyButtons.first()).toBeVisible();
	});

	it('renders the Generate Link button', async () => {
		render(InviteLinksSection, defaultProps);
		await expect.element(page.getByRole('button', { name: /generate link/i })).toBeVisible();
	});

	it('calls onCreate with null when no expiry date is set', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(InviteLinksSection, { ...defaultProps, onCreate });
		await page.getByRole('button', { name: /generate link/i }).click();
		expect(onCreate).toHaveBeenCalledWith(null);
	});

	it('shows an error message when onCreate rejects', async () => {
		const onCreate = vi.fn().mockRejectedValue(new Error('Failed to generate link.'));
		render(InviteLinksSection, { ...defaultProps, onCreate });
		await page.getByRole('button', { name: /generate link/i }).click();
		await expect.element(page.getByText('Failed to generate link.')).toBeVisible();
	});

	it('shows an error message when onRevoke rejects', async () => {
		const onRevoke = vi.fn().mockRejectedValue(new Error('Failed to revoke link.'));
		render(InviteLinksSection, { ...defaultProps, onRevoke });
		await page.getByRole('button', { name: 'Revoke link' }).first().click();
		await expect.element(page.getByText('Failed to revoke link.')).toBeVisible();
	});

	it('does not show the slug invite URL when slug invite is disabled', async () => {
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: false });
		await expect.element(page.getByRole('button', { name: 'Copy slug invite URL' })).not.toBeInTheDocument();
	});

	it('shows the slug invite copy button when slug invite is enabled', async () => {
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: true });
		await expect
			.element(page.getByRole('button', { name: 'Copy slug invite URL' }))
			.toBeVisible();
	});

	it('calls onToggleSlug with true when the switch is toggled on', async () => {
		const onToggleSlug = vi.fn().mockResolvedValue(undefined);
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: false, onToggleSlug });
		// The switch is a role="switch" element
		await page.getByRole('switch').click();
		expect(onToggleSlug).toHaveBeenCalledWith(true);
	});

	it('calls onToggleSlug with false when the switch is toggled off', async () => {
		const onToggleSlug = vi.fn().mockResolvedValue(undefined);
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: true, onToggleSlug });
		await page.getByRole('switch').click();
		expect(onToggleSlug).toHaveBeenCalledWith(false);
	});

	it('does not render the links table when inviteLinks is empty', async () => {
		render(InviteLinksSection, { ...defaultProps, inviteLinks: [] });
		await expect.element(page.getByText('V1StGXR8_Z5jdHi6B-myT')).not.toBeInTheDocument();
	});
});
