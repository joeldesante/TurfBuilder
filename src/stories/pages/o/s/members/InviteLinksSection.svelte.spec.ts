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

	it('puts the Generate Link button in the section header, beside the heading', async () => {
		const { container } = render(InviteLinksSection, defaultProps);
		const button = page.getByRole('button', { name: 'Generate Link' });
		await expect.element(button).toBeVisible();
		const header = container.querySelector('#invite-links-heading')!.parentElement!;
		expect(header.contains(button.element())).toBe(true);
	});

	it('does not show the expiration modal until Generate Link is pressed', async () => {
		render(InviteLinksSection, defaultProps);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('asks for an optional expiration date in a modal', async () => {
		render(InviteLinksSection, defaultProps);
		await page.getByRole('button', { name: 'Generate Link' }).click();
		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog.getByText('Expiration date (optional)')).toBeVisible();
	});

	it('calls onCreate with null when no expiry date is set, and closes the modal', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(InviteLinksSection, { ...defaultProps, onCreate });
		await page.getByRole('button', { name: 'Generate Link' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Generate Link' }).click();
		expect(onCreate).toHaveBeenCalledWith(null);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('closes the modal without creating a link when cancelled', async () => {
		const onCreate = vi.fn();
		render(InviteLinksSection, { ...defaultProps, onCreate });
		await page.getByRole('button', { name: 'Generate Link' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
		expect(onCreate).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows the error inside the modal and keeps it open when onCreate rejects', async () => {
		const onCreate = vi.fn().mockRejectedValue(new Error('Failed to generate link.'));
		render(InviteLinksSection, { ...defaultProps, onCreate });
		await page.getByRole('button', { name: 'Generate Link' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Generate Link' }).click();
		await expect
			.element(page.getByRole('dialog').getByText('Failed to generate link.'))
			.toBeVisible();
	});

	it('shows an error message when onRevoke rejects', async () => {
		const onRevoke = vi.fn().mockRejectedValue(new Error('Failed to revoke link.'));
		render(InviteLinksSection, { ...defaultProps, onRevoke });
		await page.getByRole('button', { name: 'Revoke link' }).first().click();
		await expect.element(page.getByText('Failed to revoke link.')).toBeVisible();
	});

	it('does not show the slug invite URL when slug invite is disabled', async () => {
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: false });
		await expect
			.element(page.getByRole('button', { name: 'Copy slug invite URL' }))
			.not.toBeInTheDocument();
	});

	it('shows the slug invite copy button when slug invite is enabled', async () => {
		render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: true });
		await expect.element(page.getByRole('button', { name: 'Copy slug invite URL' })).toBeVisible();
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

	describe('QR codes', () => {
		it('has a QR code button on each link', async () => {
			render(InviteLinksSection, defaultProps);
			expect((await page.getByRole('button', { name: 'Show QR code' }).all()).length).toBe(2);
		});

		it('shows the QR code for that link in a modal with a download button', async () => {
			render(InviteLinksSection, defaultProps);
			await page.getByRole('button', { name: 'Show QR code' }).first().click();

			const dialog = page.getByRole('dialog');
			await expect.element(dialog.getByText('Invite link QR code')).toBeVisible();
			await expect
				.element(dialog.getByRole('img', { name: /V1StGXR8_Z5jdHi6B-myT/ }))
				.toBeVisible();
			await expect.element(dialog.getByRole('button', { name: 'Download PNG' })).toBeVisible();
		});

		it('shows the code for the link that was chosen, not the first', async () => {
			render(InviteLinksSection, defaultProps);
			await page.getByRole('button', { name: 'Show QR code' }).nth(1).click();

			await expect
				.element(page.getByRole('dialog').getByRole('img', { name: /abc123xyz_DEFGH456789/ }))
				.toBeVisible();
		});

		it('has no slug QR code button while the slug invite is off', async () => {
			render(InviteLinksSection, defaultProps);
			await expect
				.element(page.getByRole('button', { name: 'Show slug invite QR code' }))
				.not.toBeInTheDocument();
		});

		it('shows the QR code for the organization slug invite when it is on', async () => {
			render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: true });
			await page.getByRole('button', { name: 'Show slug invite QR code' }).click();

			const dialog = page.getByRole('dialog');
			await expect.element(dialog.getByText('Organization invite QR code')).toBeVisible();
			await expect.element(dialog.getByRole('img', { name: /\/invite\/test-org$/ })).toBeVisible();
			await expect.element(dialog.getByRole('button', { name: 'Download PNG' })).toBeVisible();
		});

		it('leaves the link QR buttons at one per link when the slug invite is on', async () => {
			render(InviteLinksSection, { ...defaultProps, slugInviteEnabled: true });
			expect((await page.getByRole('button', { name: 'Show QR code' }).all()).length).toBe(2);
		});

		it('closes the modal from Close', async () => {
			render(InviteLinksSection, defaultProps);
			await page.getByRole('button', { name: 'Show QR code' }).first().click();
			await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
			await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		});
	});
});
