import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import OrgPicker from './OrgPicker.svelte';

const sampleOrgs = [
	{ id: '1', name: 'North West Philly Alliance', slug: 'north-west-philly-alliance' },
	{ id: '2', name: 'South Side Organizers', slug: 'south-side-organizers' }
];

describe('OrgPicker', () => {
	it('renders the heading', async () => {
		render(OrgPicker, { orgs: sampleOrgs, onSelect: vi.fn() });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Select Organization');
	});

	it('renders a button for each org', async () => {
		render(OrgPicker, { orgs: sampleOrgs, onSelect: vi.fn() });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await expect.element(page.getByText('South Side Organizers')).toBeVisible();
	});

	it('renders the org slug in each button', async () => {
		render(OrgPicker, { orgs: sampleOrgs, onSelect: vi.fn() });
		await expect.element(page.getByText('/o/north-west-philly-alliance/')).toBeVisible();
	});

	it('calls onSelect with the correct org when clicked', async () => {
		const onSelect = vi.fn();
		render(OrgPicker, { orgs: sampleOrgs, onSelect });
		await page.getByText('North West Philly Alliance').click();
		expect(onSelect).toHaveBeenCalledWith(sampleOrgs[0]);
	});

	it('renders the create org link', async () => {
		render(OrgPicker, { orgs: sampleOrgs, onSelect: vi.fn() });
		const link = page.getByRole('link', { name: 'Create a new organization' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/orgs/create');
	});

	it('renders empty state with only the create link when no orgs', async () => {
		render(OrgPicker, { orgs: [], onSelect: vi.fn() });
		const buttons = page.getByRole('button');
		await expect.element(buttons).not.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Create a new organization' }))
			.toBeVisible();
	});
});
