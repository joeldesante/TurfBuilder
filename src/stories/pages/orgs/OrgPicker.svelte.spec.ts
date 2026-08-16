import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { writable } from 'svelte/store';

const { useListOrganizationsMock } = vi.hoisted(() => ({
	useListOrganizationsMock: vi.fn()
}));

vi.mock('$lib/client', () => ({
	authClient: {
		useListOrganizations: useListOrganizationsMock
	}
}));

import OrgPicker from './OrgPicker.svelte';

const sampleOrgs = [
	{ id: '1', name: 'North West Philly Alliance', slug: 'north-west-philly-alliance' },
	{ id: '2', name: 'South Side Organizers', slug: 'south-side-organizers' }
];

function mockOrganizations(data: typeof sampleOrgs, isPending = false) {
	useListOrganizationsMock.mockReturnValue(writable({ data, isPending }));
}

describe('OrgPicker', () => {
	beforeEach(() => {
		mockOrganizations(sampleOrgs);
	});

	it('renders the heading', async () => {
		render(OrgPicker, { onSelect: vi.fn() });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Select Organization');
	});

	it('renders a button for each org', async () => {
		render(OrgPicker, { onSelect: vi.fn() });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await expect.element(page.getByText('South Side Organizers')).toBeVisible();
	});

	it('renders a loading state while organizations are pending', async () => {
		mockOrganizations([], true);
		render(OrgPicker, { onSelect: vi.fn() });
		await expect.element(page.getByText('Loading...')).toBeVisible();
	});

	it('calls onSelect with the correct org when clicked', async () => {
		const onSelect = vi.fn();
		render(OrgPicker, { onSelect });
		await page.getByText('North West Philly Alliance').click();
		expect(onSelect).toHaveBeenCalledWith(sampleOrgs[0]);
	});

	it('renders the create org link when allowCreation is true', async () => {
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const link = page.getByRole('link', { name: 'Create a new organization' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/orgs/create');
	});

	it('hides the create org link when allowCreation is false', async () => {
		render(OrgPicker, { allowCreation: false, onSelect: vi.fn() });
		await expect
			.element(page.getByRole('link', { name: 'Create a new organization' }))
			.not.toBeInTheDocument();
	});

	it('renders empty state with only the create link when no orgs', async () => {
		mockOrganizations([]);
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const buttons = page.getByRole('button');
		await expect.element(buttons).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Create a new organization' }))
			.toBeVisible();
	});
});
