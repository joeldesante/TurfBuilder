import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarItem from './SidebarItem.svelte';

const testItem = { label: 'Dashboard', href: '/system' };

describe('SidebarItem', () => {
	describe('button mode', () => {
		it('renders a button and calls onclick when given an onclick', async () => {
			const onclick = vi.fn();
			const screen = render(SidebarItem, { item: { label: 'Survey' }, onclick });
			await screen.getByRole('button', { name: 'Survey' }).click();
			expect(onclick).toHaveBeenCalledTimes(1);
		});
	});

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

		it('opens an external item in a new tab', async () => {
			const screen = render(SidebarItem, { item: { label: 'Analytics', href: 'https://a.example.com', external: true } });
			const link = screen.getByRole('link', { name: /Analytics/ });
			await expect.element(link).toHaveAttribute('target', '_blank');
			await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
		});

		it('keeps an internal item in the same tab', async () => {
			const screen = render(SidebarItem, { item: testItem });
			await expect.element(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('target');
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
			expect(link.classList.contains('bg-primary')).toBe(true);
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

	describe('badge', () => {
		it('shows a large count in compact form', async () => {
			const screen = render(SidebarItem, { item: { ...testItem, badge: 65_400 } });
			await expect.element(screen.getByText('65.4k')).toBeVisible();
		});

		it('describes the exact count for screen readers and as a title', async () => {
			const screen = render(SidebarItem, {
				item: { ...testItem, badge: 65_432, badgeLabel: 'locations matching the current filters' }
			});
			await expect
				.element(screen.getByRole('link', { name: /65,432 locations matching the current filters/ }))
				.toBeVisible();
			await expect
				.element(screen.getByText('65.4k'))
				.toHaveAttribute('title', '65,432 locations matching the current filters');
		});

		it('hides the compact figure from assistive technology', async () => {
			const screen = render(SidebarItem, { item: { ...testItem, badge: 65_432 } });
			await expect.element(screen.getByText('65.4k')).toHaveAttribute('aria-hidden', 'true');
		});

		it('shows a zero count', async () => {
			const screen = render(SidebarItem, { item: { ...testItem, badge: 0 } });
			await expect.element(screen.getByText('0', { exact: true }).first()).toHaveAttribute('aria-hidden', 'true');
		});

		it('shows nothing without a badge', async () => {
			const screen = render(SidebarItem, { item: testItem });
			await expect.element(screen.getByText('0', { exact: true })).not.toBeInTheDocument();
		});

		it('hides the badge when collapsed', async () => {
			const screen = render(SidebarItem, { item: { ...testItem, badge: 7 }, collapsed: true });
			await expect.element(screen.getByText('7', { exact: true })).not.toBeInTheDocument();
		});
	});
});
