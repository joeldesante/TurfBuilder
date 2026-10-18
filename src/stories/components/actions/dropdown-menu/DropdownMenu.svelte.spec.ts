import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DropdownMenu from './DropdownMenu.svelte';
import { createRawSnippet } from 'svelte';

const trigger = createRawSnippet(() => ({
	render: () => `<span>Open Menu</span>`
}));

const basicItems = [
	{ label: 'Edit', onclick: () => {} },
	{ label: 'Delete', variant: 'destructive' as const, onclick: () => {} }
];

describe('DropdownMenu', () => {
	describe('own trigger', () => {
		const ownButton = createRawSnippet((props: () => Record<string, unknown>) => ({
			render: () => `<button data-own>Choose</button>`,
			setup: (node: Element) => {
				for (const [key, value] of Object.entries(props())) {
					if (key.startsWith('on') && typeof value === 'function') {
						node.addEventListener(key.slice(2), value as EventListener);
					} else if (typeof value === 'string' || typeof value === 'boolean') {
						node.setAttribute(key, String(value));
					}
				}
			}
		}));

		it('makes the given button the trigger, without wrapping it in another button', async () => {
			const screen = render(DropdownMenu, { trigger: ownButton, items: basicItems });

			const own = screen.container.querySelector('[data-own]')!;
			expect(own.closest('button')).toBe(own);
			expect(own.parentElement?.closest('button')).toBeNull();
			expect(screen.container.querySelectorAll('button')).toHaveLength(1);
		});

		it('opens the menu from the given button', async () => {
			const screen = render(DropdownMenu, { trigger: ownButton, items: basicItems });

			await screen.getByRole('button', { name: 'Choose' }).click();

			await expect.element(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
		});
	});

	describe('trigger', () => {
		it('renders the trigger content', async () => {
			const screen = render(DropdownMenu, {
				children: trigger,
				items: basicItems
			});
			const triggerText = screen.getByText('Open Menu');
			await expect.element(triggerText).toBeVisible();
		});
	});

	describe('menu content (opened)', () => {
		it('renders menu items when open', async () => {
			const screen = render(DropdownMenu, {
				children: trigger,
				items: basicItems,
				open: true
			});
			// Bits UI portals menu content; search the full document
			const editItem = document.body.querySelector('[data-dropdown-menu-content]');
			expect(editItem).not.toBeNull();
		});

		it('renders item labels in the portal', async () => {
			render(DropdownMenu, {
				children: trigger,
				items: [{ label: 'Settings', onclick: () => {} }],
				open: true
			});
			// Menu items are portaled to document body
			const menuContent = document.body.querySelector('[data-dropdown-menu-content]');
			expect(menuContent?.textContent).toContain('Settings');
		});

		it('renders separator between items', async () => {
			render(DropdownMenu, {
				children: trigger,
				items: [
					{ label: 'Edit', onclick: () => {} },
					{ separator: true as const },
					{ label: 'Delete', onclick: () => {} }
				],
				open: true
			});
			const separator = document.body.querySelector('[data-dropdown-menu-separator]');
			expect(separator).not.toBeNull();
		});

		it('renders items with href as links', async () => {
			render(DropdownMenu, {
				children: trigger,
				items: [{ label: 'Go to Profile', href: '/profile' }],
				open: true
			});
			const menuContent = document.body.querySelector('[data-dropdown-menu-content]');
			const link = menuContent?.querySelector('a[href="/profile"]');
			expect(link).not.toBeNull();
			expect(link?.textContent).toContain('Go to Profile');
		});

		it('marks disabled items with data-disabled', async () => {
			render(DropdownMenu, {
				children: trigger,
				items: [{ label: 'Locked', disabled: true, onclick: () => {} }],
				open: true
			});
			const menuContent = document.body.querySelector('[data-dropdown-menu-content]');
			const disabledItem = menuContent?.querySelector('[data-disabled]');
			expect(disabledItem).not.toBeNull();
		});
	});
});
