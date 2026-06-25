import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PageHeader from './PageHeader.svelte';
import { createRawSnippet } from 'svelte';

describe('PageHeader', () => {
	describe('title', () => {
		it('renders an h1 with the title text', async () => {
			const screen = render(PageHeader, { title: 'Dashboard' });
			const heading = screen.getByRole('heading', { level: 1 });
			await expect.element(heading).toHaveTextContent('Dashboard');
		});
	});

	describe('subheading', () => {
		it('renders subheading text when provided', async () => {
			const screen = render(PageHeader, {
				title: 'Dashboard',
				subheading: 'Overview of your campaigns'
			});
			const sub = screen.getByText('Overview of your campaigns');
			await expect.element(sub).toBeVisible();
		});

		it('does not render subheading when not provided', async () => {
			const screen = render(PageHeader, { title: 'Dashboard' });
			const paragraphs = screen.container.querySelectorAll('p');
			expect(paragraphs.length).toBe(0);
		});
	});

	describe('breadcrumbs', () => {
		it('renders breadcrumb navigation when breadcrumbs are provided', async () => {
			const screen = render(PageHeader, {
				title: 'Turf Detail',
				breadcrumbs: [
					{ label: 'Home', href: '/' },
					{ label: 'Turfs', href: '/turfs' },
					{ label: 'Turf Detail' }
				]
			});
			const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
			await expect.element(nav).toBeVisible();
		});

		it('renders breadcrumb items as links when href is provided', async () => {
			const screen = render(PageHeader, {
				title: 'Detail',
				breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Current' }]
			});
			const link = screen.getByRole('link', { name: 'Home' });
			await expect.element(link).toBeVisible();
		});

		it('renders last breadcrumb as plain text (no href)', async () => {
			const screen = render(PageHeader, {
				title: 'Detail',
				breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Current' }]
			});
			// "Current" should be a span, not a link
			const currentItem = screen.getByText('Current');
			await expect.element(currentItem).toBeVisible();
			expect(currentItem.element().tagName.toLowerCase()).toBe('span');
		});

		it('renders separator between breadcrumb items', async () => {
			const screen = render(PageHeader, {
				title: 'Detail',
				breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Current' }]
			});
			const separator = screen.getByText('/');
			expect(separator.element().getAttribute('aria-hidden')).toBe('true');
		});

		it('does not render breadcrumb nav when no breadcrumbs provided', async () => {
			const screen = render(PageHeader, { title: 'Simple' });
			const nav = screen.container.querySelector('nav');
			expect(nav).toBeNull();
		});
	});

	describe('actions slot', () => {
		it('renders action content when actions snippet is provided', async () => {
			const actions = createRawSnippet(() => ({
				render: () => `<button data-testid="action-btn">New Turf</button>`
			}));
			const screen = render(PageHeader, { title: 'Turfs', actions });
			const actionBtn = screen.getByText('New Turf');
			await expect.element(actionBtn).toBeVisible();
		});

		it('does not render actions container when no actions provided', async () => {
			const screen = render(PageHeader, { title: 'Simple' });
			// No action container should exist
			const headingParent = screen.getByRole('heading', { level: 1 }).element().parentElement;
			const actionContainer = headingParent?.parentElement?.querySelector('.flex.gap-3');
			expect(actionContainer).toBeNull();
		});
	});
});
