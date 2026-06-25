import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Sidebar from './Sidebar.svelte';
import type { SidebarNavEntry } from './types';

const testNav: SidebarNavEntry[] = [
	{ kind: 'item', item: { label: 'Dashboard', href: '/system' } },
	{
		kind: 'section',
		section: {
			label: 'Management',
			items: [
				{ label: 'Users', href: '/system/users' },
				{ label: 'Turfs', href: '/system/turfs' }
			]
		}
	}
];

describe('Sidebar', () => {
	describe('rendering', () => {
		it('renders as a nav element with system navigation label', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const nav = screen.getByRole('navigation', { name: 'System navigation' });
			await expect.element(nav).toBeVisible();
		});

		it('renders top-level nav items', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const dashboard = screen.getByRole('link', { name: 'Dashboard' });
			await expect.element(dashboard).toBeVisible();
		});

		it('renders section items', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const users = screen.getByRole('link', { name: 'Users' });
			const turfs = screen.getByRole('link', { name: 'Turfs' });
			await expect.element(users).toBeVisible();
			await expect.element(turfs).toBeVisible();
		});

		it('renders section label', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const label = screen.getByText('Management');
			await expect.element(label).toBeVisible();
		});
	});

	describe('user menu', () => {
		it('displays the username', async () => {
			const screen = render(Sidebar, { nav: testNav, username: 'Sabina' });
			const username = screen.getByText('Sabina');
			await expect.element(username).toBeVisible();
		});

		it('renders an avatar with the username', async () => {
			const screen = render(Sidebar, { nav: testNav, username: 'Sabina' });
			const avatar = screen.getByRole('img', { name: 'Sabina' });
			await expect.element(avatar).toBeVisible();
		});

		it('defaults username to "User"', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const avatar = screen.getByRole('img', { name: 'User' });
			await expect.element(avatar).toBeVisible();
		});
	});

	describe('collapse toggle', () => {
		it('renders a collapse/expand button', async () => {
			const screen = render(Sidebar, { nav: testNav });
			const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' });
			await expect.element(collapseBtn).toBeInTheDocument();
		});

		it('shows "Expand sidebar" label when collapsed', async () => {
			const screen = render(Sidebar, { nav: testNav, collapsed: true });
			const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' });
			await expect.element(expandBtn).toBeInTheDocument();
		});
	});

	describe('active state', () => {
		it('marks the matching item as active based on currentPath', async () => {
			const screen = render(Sidebar, {
				nav: testNav,
				currentPath: '/system'
			});
			const dashboard = screen.getByRole('link', { name: 'Dashboard' });
			await expect.element(dashboard).toHaveAttribute('aria-current', 'page');
		});

		it('does not mark non-matching items as active', async () => {
			const screen = render(Sidebar, {
				nav: testNav,
				currentPath: '/system'
			});
			const users = screen.getByRole('link', { name: 'Users' });
			expect(users.element().hasAttribute('aria-current')).toBe(false);
		});
	});
});
