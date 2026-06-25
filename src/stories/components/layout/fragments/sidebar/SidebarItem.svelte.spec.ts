import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarItem from './SidebarItem.svelte';

const testItem = { label: 'Dashboard', href: '/system' };

describe('SidebarItem', () => {
	describe('rendering', () => {
		it('renders as a link with the correct href', async () => {
			const screen = render(SidebarItem, { item: testItem });
			const link = screen.getByRole('link', { name: 'Dashboard' });
			await expect.element(link).toHaveAttribute('href', '/system');
		});

		it('displays the item label text', async () => {
			const screen = render(SidebarItem, { item: testItem });
			const label = screen.getByText('Dashboard');
			await expect.element(label).toBeVisible();
		});
	});

	describe('active state', () => {
		it('sets aria-current="page" when active', async () => {
			const screen = render(SidebarItem, { item: testItem, active: true });
			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('aria-current', 'page');
		});

		it('does not set aria-current when inactive', async () => {
			const screen = render(SidebarItem, { item: testItem, active: false });
			const link = screen.getByRole('link');
			expect(link.element().hasAttribute('aria-current')).toBe(false);
		});

		it('applies active styling classes when active', async () => {
			const screen = render(SidebarItem, { item: testItem, active: true });
			const link = screen.getByRole('link').element();
			expect(link.classList.contains('bg-primary-container')).toBe(true);
		});

		it('applies inactive styling classes when not active', async () => {
			const screen = render(SidebarItem, { item: testItem, active: false });
			const link = screen.getByRole('link').element();
			expect(link.classList.contains('text-on-surface-subtle')).toBe(true);
		});
	});

	describe('collapsed state', () => {
		it('sets title attribute when collapsed', async () => {
			const screen = render(SidebarItem, { item: testItem, collapsed: true });
			const link = screen.getByRole('link');
			await expect.element(link).toHaveAttribute('title', 'Dashboard');
		});

		it('does not set title when not collapsed', async () => {
			const screen = render(SidebarItem, { item: testItem, collapsed: false });
			const link = screen.getByRole('link');
			expect(link.element().hasAttribute('title')).toBe(false);
		});

		it('hides label text with max-w-0 when collapsed', async () => {
			const screen = render(SidebarItem, { item: testItem, collapsed: true });
			const labelSpan = screen.getByText('Dashboard').element();
			expect(labelSpan.classList.contains('max-w-0')).toBe(true);
		});
	});
});
