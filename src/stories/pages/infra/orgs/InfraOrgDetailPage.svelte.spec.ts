import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraOrgDetailPage, { type OrgActions } from './InfraOrgDetailPage.svelte';
import { orgDetail, members, invitations, inviteLinks, pageOf } from './fixtures';

function actions(): OrgActions {
	return {
		suspend: vi.fn(async () => {}),
		unsuspend: vi.fn(async () => {}),
		transferOwnership: vi.fn(async () => {}),
		searchMembers: vi.fn(async () => members.map((m) => ({ memberId: m.memberId, name: m.name, email: m.email, memberRole: m.memberRole }))),
		remove: vi.fn(async () => {}),
		restore: vi.fn(async () => {}),
		removeMember: vi.fn(async () => {}),
		cancelInvitation: vi.fn(async () => {}),
		revokeLink: vi.fn(async () => {})
	};
}

const permissions = ['access', 'orgs.manage', 'audit.read'];
const base = { org: orgDetail, tab: 'overview' as const, members: pageOf(members), permissions };

describe('InfraOrgDetailPage', () => {
	test('shows who runs the org, linked to their pages', async () => {
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, actions: actions() } });

		await expect.element(getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', `/infra/users/${orgDetail.leaders[1].userId}`);
		await expect.element(getByRole('heading', { name: 'Who runs it' })).toBeVisible();
	});

	test('suspending needs a reason, then sends it', async () => {
		const a = actions();
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, actions: a } });

		await getByRole('button', { name: /Actions/ }).click();
		await getByRole('menuitem', { name: 'Suspend' }).click();
		await getByRole('button', { name: 'Suspend' }).click();
		await expect.element(getByRole('alert')).toHaveTextContent('Give a reason');
		expect(a.suspend).not.toHaveBeenCalled();

		await getByRole('textbox', { name: 'Reason' }).fill('Spam');
		await getByRole('button', { name: 'Suspend' }).click();
		expect(a.suspend).toHaveBeenCalledWith('Spam');
	});

	test('deleting needs the slug typed back', async () => {
		const a = actions();
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, actions: a } });

		await getByRole('button', { name: /Actions/ }).click();
		await getByRole('menuitem', { name: 'Delete organization' }).click();
		await getByRole('textbox', { name: `Type ${orgDetail.slug} to confirm` }).fill('wrong');
		await getByRole('button', { name: 'Delete organization' }).click();
		expect(a.remove).not.toHaveBeenCalled();

		await getByRole('textbox', { name: `Type ${orgDetail.slug} to confirm` }).fill(orgDetail.slug);
		await getByRole('button', { name: 'Delete organization' }).click();
		expect(a.remove).toHaveBeenCalledWith(orgDetail.slug);
	});

	test('finds the new owner by search, leaving out current owners, then transfers', async () => {
		const a = actions();
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, members: null, actions: a } });

		await getByRole('button', { name: /Actions/ }).click();
		await getByRole('menuitem', { name: 'Transfer ownership' }).click();
		await getByRole('searchbox', { name: 'Find a member' }).fill('kath');
		await getByRole('dialog').getByRole('button', { name: 'Search' }).click();
		expect(a.searchMembers).toHaveBeenCalledWith('kath');

		const select = getByRole('combobox', { name: 'New owner' });
		await expect.element(select).not.toHaveTextContent('Grace Hopper');
		await select.selectOptions(members[1].memberId);
		await getByRole('button', { name: 'Transfer' }).click();

		expect(a.transferOwnership).toHaveBeenCalledWith(members[1].memberId);
	});

	test('offers restore, not suspend or delete, for a deleted org', async () => {
		const { getByRole } = render(InfraOrgDetailPage, {
			props: { ...base, org: { ...orgDetail, deleted: true, deletedAt: '2026-10-05T10:00:00.000Z' }, actions: actions() }
		});

		await getByRole('button', { name: /Actions/ }).click();
		await expect.element(getByRole('menuitem', { name: 'Restore' })).toBeVisible();
		await expect.element(getByRole('menuitem', { name: 'Delete organization' })).not.toBeInTheDocument();
	});

	test('removes a member but never the owner', async () => {
		const a = actions();
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, tab: 'members', actions: a } });

		await expect.element(getByRole('button', { name: 'Remove Grace Hopper' })).not.toBeInTheDocument();
		await getByRole('button', { name: 'Remove Katherine Johnson' }).click();
		await getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
		expect(a.removeMember).toHaveBeenCalledWith(members[1].memberId);
	});

	test('cancels an invitation and turns off a link', async () => {
		const a = actions();
		const { getByRole } = render(InfraOrgDetailPage, {
			props: { ...base, tab: 'invitations', invitations: { invitations, links: inviteLinks }, actions: a }
		});

		await getByRole('button', { name: /Cancel invitation for new.volunteer/ }).click();
		expect(a.cancelInvitation).toHaveBeenCalledWith(invitations[0].id);
		await getByRole('button', { name: /Turn off link/ }).click();
		expect(a.revokeLink).toHaveBeenCalledWith(inviteLinks[0].id);
	});

	test('hides every action without orgs.manage', async () => {
		const { getByRole } = render(InfraOrgDetailPage, { props: { ...base, permissions: ['access'], tab: 'members', actions: actions() } });

		await expect.element(getByRole('button', { name: /Actions/ })).not.toBeInTheDocument();
		await expect.element(getByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
	});
});
