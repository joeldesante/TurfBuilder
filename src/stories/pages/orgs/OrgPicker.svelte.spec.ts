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
import { pageLoader } from '$lib/client/page-loader.svelte';

const sampleOrgs = [
	{ id: '1', name: 'North West Philly Alliance', slug: 'north-west-philly-alliance' },
	{ id: '2', name: 'South Side Organizers', slug: 'south-side-organizers' }
];

function mockOrganizations(data: typeof sampleOrgs, isPending = false) {
	useListOrganizationsMock.mockReturnValue(writable({ data, isPending }));
}

describe('OrgPicker', () => {
	beforeEach(() => {
		pageLoader.hide();
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
		render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 50 });
		await expect.poll(() => pageLoader.active).toBe(true);
		await expect.element(page.getByRole('heading', { level: 1 })).not.toBeInTheDocument();
	});

	it('never raises the loader when the organizations are already there', async () => {
		render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 50 });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(pageLoader.active).toBe(false);
	});

	it('does not raise the loader when the organizations arrive before the delay', async () => {
		const store = writable({ data: [] as typeof sampleOrgs, isPending: true });
		useListOrganizationsMock.mockReturnValue(store);
		render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 300 });
		store.set({ data: sampleOrgs, isPending: false });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(pageLoader.active).toBe(false);
	});

	it('raises the loader when the organizations are slow, and puts it away when they arrive', async () => {
		const store = writable({ data: [] as typeof sampleOrgs, isPending: true });
		useListOrganizationsMock.mockReturnValue(store);
		render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 50 });
		await expect.poll(() => pageLoader.active).toBe(true);
		store.set({ data: sampleOrgs, isPending: false });
		await expect.poll(() => pageLoader.active).toBe(false);
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
	});

	it('keeps a loader raised before it mounted up until the organizations arrive', async () => {
		const store = writable({ data: [] as typeof sampleOrgs, isPending: true });
		useListOrganizationsMock.mockReturnValue(store);
		pageLoader.show();
		render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 50 });
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(pageLoader.active).toBe(true);
		store.set({ data: sampleOrgs, isPending: false });
		await expect.poll(() => pageLoader.active).toBe(false);
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
	});

	it('puts away a loader raised before it mounted when the organizations are already there', async () => {
		pageLoader.show();
		render(OrgPicker, { onSelect: vi.fn() });
		await expect.poll(() => pageLoader.active).toBe(false);
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
	});

	it('puts the loader away when it is left while the organizations are still loading', async () => {
		mockOrganizations([], true);
		const screen = render(OrgPicker, { onSelect: vi.fn(), loaderDelayMs: 50 });
		await expect.poll(() => pageLoader.active).toBe(true);
		screen.unmount();
		expect(pageLoader.active).toBe(false);
	});

	it('shows an error, not the welcome message, when the organizations fail to load', async () => {
		useListOrganizationsMock.mockReturnValue(
			writable({ data: null, error: { status: 500 }, isPending: false })
		);
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		await expect
			.element(
				page.getByText('Your organizations failed to load. Reload the page or try again later.')
			)
			.toBeVisible();
		await expect.element(page.getByText('You are not yet in an organization.')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: "I'm here to canvass" }))
			.not.toBeInTheDocument();
	});

	it('has no account menu without a signed-in user', async () => {
		render(OrgPicker, { onSelect: vi.fn() });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Account menu' }))
			.not.toBeInTheDocument();
	});

	it.each([
		['the organization list', sampleOrgs, null],
		['the empty state', [], null],
		['the load error', null, { status: 500 }]
	])('offers sign out from the account menu on %s', async (_name, data, error) => {
		useListOrganizationsMock.mockReturnValue(writable({ data, error, isPending: false }));
		const onsignout = vi.fn();
		render(OrgPicker, { onSelect: vi.fn(), email: 'alex@example.com', onsignout });
		await page.getByRole('button', { name: 'Account menu' }).click();
		await expect.element(page.getByText('alex@example.com')).toBeVisible();
		await page.getByRole('menuitem', { name: 'Sign Out' }).click();
		expect(onsignout).toHaveBeenCalledTimes(1);
	});

	it('labels the account menu avatar with the name, not the email', async () => {
		render(OrgPicker, {
			onSelect: vi.fn(),
			name: 'Ada Lovelace',
			email: 'zed@example.com',
			onsignout: vi.fn()
		});
		const avatar = page.getByRole('img', { name: 'Ada Lovelace' });
		await expect.element(avatar).toBeVisible();
		await expect.element(avatar).toHaveTextContent('Ad');
	});

	it('calls onSelect with the correct org when clicked', async () => {
		const onSelect = vi.fn();
		render(OrgPicker, { onSelect });
		await page.getByText('North West Philly Alliance').click();
		expect(onSelect).toHaveBeenCalledWith(sampleOrgs[0]);
	});

	it('renders a start a new movement button when allowCreation is true', async () => {
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const create = page.getByRole('link', { name: 'Start a New Movement' });
		await expect.element(create).toBeVisible();
		expect(create.element().getAttribute('href')).toBe('/orgs/create');
	});

	it('puts the start a new movement button inline with the page title', async () => {
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const create = page.getByRole('link', { name: 'Start a New Movement' });
		const title = page.getByRole('heading', { name: 'Select Organization' });
		await expect.element(create).toBeVisible();
		await expect.element(title).toBeVisible();
		// Tailwind's stylesheet is not loaded in component tests, so check that both sit in the
		// header's flex row rather than measuring positions.
		const row = create.element().closest('.justify-between');
		expect(row).toBeTruthy();
		expect(row!.contains(title.element())).toBe(true);
	});

	it('offers a floating + on phones that opens create and join', async () => {
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const fab = page.getByRole('button', { name: 'Create or join an organization' });
		await expect.element(fab).toBeVisible();
		// Tailwind is not loaded in component tests, so check the classes that pin and scope it.
		const wrapper = fab.element().parentElement!;
		expect(wrapper.classList.contains('fixed')).toBe(true);
		expect(wrapper.classList.contains('md:hidden')).toBe(true);
		await expect
			.element(page.getByRole('link', { name: 'Join an organization' }))
			.not.toBeInTheDocument();
		await fab.click();
		const create = page.getByRole('link', { name: 'Create an organization' });
		const join = page.getByRole('link', { name: 'Join an organization' });
		await expect.element(create).toBeVisible();
		await expect.element(join).toBeVisible();
		expect(create.element().getAttribute('href')).toBe('/orgs/create');
		expect(join.element().getAttribute('href')).toBe('/orgs/join');
		await page.getByRole('button', { name: 'Close menu' }).click();
		await expect.element(join).not.toBeInTheDocument();
	});

	it('closes the floating menu when pressing outside it or Escape', async () => {
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const join = page.getByRole('link', { name: 'Join an organization' });
		await page.getByRole('button', { name: 'Create or join an organization' }).click();
		await expect.element(join).toBeVisible();
		// Pressing inside the options leaves it open.
		await page.getByRole('link', { name: 'Create an organization' }).element().dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true })
		);
		await expect.element(join).toBeVisible();
		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await expect.element(join).not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Create or join an organization' }).click();
		await expect.element(join).toBeVisible();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect.element(join).not.toBeInTheDocument();
	});

	it('offers only join in the floating menu when creation is not allowed', async () => {
		render(OrgPicker, { allowCreation: false, onSelect: vi.fn() });
		await page.getByRole('button', { name: 'Create or join an organization' }).click();
		await expect.element(page.getByRole('link', { name: 'Join an organization' })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Create an organization' }))
			.not.toBeInTheDocument();
	});

	it('hides the start a new movement button when allowCreation is false', async () => {
		render(OrgPicker, { allowCreation: false, onSelect: vi.fn() });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Start a New Movement' }))
			.not.toBeInTheDocument();
	});

	it('shows a centered welcome message when the user is in no organizations', async () => {
		mockOrganizations([]);
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		await expect.element(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
		await expect.element(page.getByText('You are not yet in an organization.')).toBeVisible();
		await expect.poll(() => pageLoader.active).toBe(false);
	});

	it('offers two ways forward when the user is in no organizations', async () => {
		mockOrganizations([]);
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		await expect.element(page.getByRole('link', { name: "I'm here to canvass" })).toBeVisible();
		const create = page.getByRole('link', { name: "I'm here to build" });
		await expect.element(create).toBeVisible();
		expect(create.element().getAttribute('href')).toBe('/orgs/create');
	});

	it('hides the build option when creation is not allowed and the user is in no organizations', async () => {
		mockOrganizations([]);
		render(OrgPicker, { allowCreation: false, onSelect: vi.fn() });
		await expect.element(page.getByRole('link', { name: "I'm here to canvass" })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: "I'm here to build" }))
			.not.toBeInTheDocument();
	});

	it('does not show the welcome message when the user has organizations', async () => {
		render(OrgPicker, { onSelect: vi.fn() });
		await expect.element(page.getByText('North West Philly Alliance')).toBeVisible();
		await expect
			.element(page.getByText('You are not yet in an organization.'))
			.not.toBeInTheDocument();
	});

	it('disables text selection on the welcome text and buttons', async () => {
		mockOrganizations([]);
		render(OrgPicker, { allowCreation: true, onSelect: vi.fn() });
		const heading = page.getByRole('heading', { level: 1, name: 'Welcome' });
		await expect.element(heading).toBeVisible();
		for (const target of [
			heading,
			page.getByText('You are not yet in an organization.'),
			page.getByRole('link', { name: "I'm here to build" }),
			page.getByRole('link', { name: "I'm here to canvass" })
		]) {
			// Tailwind's stylesheet is not loaded in component tests, so check the class that sets
			// user-select: none rather than the computed style.
			expect(target.element().closest('.select-none')).toBeTruthy();
		}
	});
});
