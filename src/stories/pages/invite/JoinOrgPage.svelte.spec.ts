import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import JoinOrgPage from './JoinOrgPage.svelte';

const orgName = 'North West Philly Alliance';
const orgSlug = 'north-west-philly-alliance';

describe('JoinOrgPage', () => {
	it('renders the org name as heading', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: false });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent(orgName);
	});

	it('shows the Join button when not already a member', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: false });
		await expect.element(page.getByRole('button', { name: `Join ${orgName}` })).toBeVisible();
	});

	it('does not show the Join button when already a member', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: true });
		await expect
			.element(page.getByRole('button', { name: `Join ${orgName}` }))
			.not.toBeInTheDocument();
	});

	it('shows already-a-member message when already a member', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: true });
		await expect
			.element(page.getByText(`You're already a member of`))
			.toBeVisible();
	});

	it('shows a link to the org when already a member', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: true });
		const link = page.getByRole('link', { name: `Go to ${orgName}` });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe(`/o/${orgSlug}`);
	});

	it('does not show the org link when not yet a member', async () => {
		render(JoinOrgPage, { orgName, orgSlug, alreadyMember: false });
		await expect
			.element(page.getByRole('link', { name: `Go to ${orgName}` }))
			.not.toBeInTheDocument();
	});
});
