import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { describe, expect, test, vi } from 'vitest';
import InfraUserDetailPage, { type UserActions } from './InfraUserDetailPage.svelte';
import { memberships, sessions, userDetail } from './fixtures';
import { INFRA_PERMISSIONS } from '$lib/shared/types/infra';

function actions(overrides: Partial<UserActions> = {}): UserActions {
	const done = vi.fn(async () => {});
	return {
		update: done,
		sendPasswordReset: done,
		sendVerification: done,
		resetTwoFactor: done,
		suspend: done,
		unsuspend: done,
		revokeSessions: done,
		revokeSession: done,
		impersonate: done,
		remove: done,
		...overrides
	};
}

function setup(props: Record<string, unknown> = {}) {
	return render(InfraUserDetailPage, {
		props: {
			user: userDetail,
			tab: 'overview',
			memberships,
			sessions,
			permissions: [...INFRA_PERMISSIONS],
			currentUserId: 'admin',
			actions: actions(),
			...props
		}
	});
}

describe('InfraUserDetailPage', () => {
	test('summarizes the account', async () => {
		setup();

		await expect.element(page.getByRole('heading', { name: userDetail.name })).toBeVisible();
		await expect.element(page.getByText('Email not verified')).toBeVisible();
		await expect.element(page.getByText('Email and password')).toBeVisible();
	});

	test('sends a password reset after confirming', async () => {
		const sendPasswordReset = vi.fn(async () => {});
		setup({ actions: actions({ sendPasswordReset }) });

		await page.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Send password reset' }).click();
		await page.getByRole('button', { name: 'Send' }).click();

		expect(sendPasswordReset).toHaveBeenCalledOnce();
	});

	test('needs a reason to suspend', async () => {
		const suspend = vi.fn(async () => {});
		setup({ actions: actions({ suspend }) });

		await page.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Suspend' }).click();
		await page.getByRole('button', { name: 'Suspend' }).click();
		await expect.element(page.getByText(/Give a reason/)).toBeVisible();
		expect(suspend).not.toHaveBeenCalled();

		await page.getByRole('textbox', { name: 'Reason' }).fill('Spam');
		await page.getByRole('button', { name: 'Suspend' }).click();
		expect(suspend).toHaveBeenCalledWith({ reason: 'Spam', expiresAt: null });
	});

	test('shows the server message when an action fails', async () => {
		const sendPasswordReset = vi.fn(async () => {
			throw new Error('Outgoing mail is not set up.');
		});
		setup({ actions: actions({ sendPasswordReset }) });

		await page.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Send password reset' }).click();
		await page.getByRole('button', { name: 'Send' }).click();

		await expect.element(page.getByText('Outgoing mail is not set up.')).toBeVisible();
	});

	test('deletes only once the email is typed back', async () => {
		const remove = vi.fn(async () => {});
		setup({ actions: actions({ remove }) });

		await page.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete account' }).click();
		await page.getByRole('button', { name: 'Delete account' }).click();
		expect(remove).not.toHaveBeenCalled();

		await page.getByRole('textbox', { name: /to confirm/ }).fill(userDetail.email);
		await page.getByRole('button', { name: 'Delete account' }).click();
		expect(remove).toHaveBeenCalledWith(userDetail.email);
	});

	test('offers no actions to a read-only admin', async () => {
		setup({ permissions: ['access'] });

		await expect.element(page.getByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
	});

	test('does not offer to suspend or delete yourself', async () => {
		setup({ currentUserId: userDetail.id });

		await page.getByRole('button', { name: 'Actions' }).click();
		await expect.element(page.getByRole('menuitem', { name: 'Edit details' })).toBeVisible();
		await expect.element(page.getByRole('menuitem', { name: 'Suspend' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'Delete account' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'Impersonate' })).not.toBeInTheDocument();
	});

	test('lists sessions and ends one', async () => {
		const revokeSession = vi.fn(async () => {});
		setup({ tab: 'sessions', actions: actions({ revokeSession }) });

		await expect.element(page.getByText('Chrome on macOS')).toBeVisible();
		await page.getByRole('button', { name: 'End session' }).click();
		expect(revokeSession).toHaveBeenCalledWith(sessions[0].id);
	});

	test('links each organization', async () => {
		setup({ tab: 'organizations' });

		await expect
			.element(page.getByRole('link', { name: 'Riverside Canvass' }))
			.toHaveAttribute('href', `/infra/orgs/${memberships[0].organizationId}`);
		await expect.element(page.getByText('Administrator, owner')).toBeVisible();
	});
});
