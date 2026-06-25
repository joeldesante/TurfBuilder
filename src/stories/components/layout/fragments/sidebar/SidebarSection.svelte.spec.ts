import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarSection from './SidebarSection.svelte';

const testSection = {
	label: 'Management',
	items: [
		{ label: 'Users', href: '/system/users' },
		{ label: 'Turfs', href: '/system/turfs' }
	]
};

describe('SidebarSection', () => {
	describe('rendering', () => {
		it('renders the section label', async () => {
			const screen = render(SidebarSection, { section: testSection });
			const label = screen.getByText('Management');
			await expect.element(label).toBeVisible();
		});

		it('renders all section items as links', async () => {
			const screen = render(SidebarSection, { section: testSection });
			const links = screen.container.querySelectorAll('a');
			expect(links.length).toBe(2);
		});

		it('renders item labels', async () => {
			const screen = render(SidebarSection, { section: testSection });
			const users = screen.getByText('Users');
			const turfs = screen.getByText('Turfs');
			await expect.element(users).toBeVisible();
			await expect.element(turfs).toBeVisible();
		});
	});

	describe('active state propagation', () => {
		it('marks the matching item as active based on currentPath', async () => {
			const screen = render(SidebarSection, {
				section: testSection,
				currentPath: '/system/users'
			});
			const usersLink = screen.getByRole('link', { name: 'Users' });
			await expect.element(usersLink).toHaveAttribute('aria-current', 'page');
		});

		it('does not mark non-matching items as active', async () => {
			const screen = render(SidebarSection, {
				section: testSection,
				currentPath: '/system/users'
			});
			const turfsLink = screen.getByRole('link', { name: 'Turfs' });
			expect(turfsLink.element().hasAttribute('aria-current')).toBe(false);
		});
	});

	describe('collapsed state', () => {
		it('hides the section label when collapsed', async () => {
			const screen = render(SidebarSection, {
				section: testSection,
				collapsed: true
			});
			// The section label paragraph is conditionally rendered
			const labels = screen.container.querySelectorAll('p');
			expect(labels.length).toBe(0);
		});

		it('still renders items when collapsed', async () => {
			const screen = render(SidebarSection, {
				section: testSection,
				collapsed: true
			});
			const links = screen.container.querySelectorAll('a');
			expect(links.length).toBe(2);
		});
	});
});
