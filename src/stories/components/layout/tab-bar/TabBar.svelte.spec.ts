import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TabBar from './TabBar.svelte';
import type { Tab } from './TabBar.svelte';

const tabs: Tab[] = [
	{ id: '1', label: 'Tab 1' },
	{ id: '2', label: 'Tab 2' }
];

describe('TabBar', () => {
	it('renders a tab for each entry', async () => {
		const screen = render(TabBar, {
			tabs,
			activeId: '1',
			onSelect: () => {},
			onAdd: () => {},
			onClose: () => {},
			onReorder: () => {}
		});
		await expect.element(screen.getByText('Tab 1')).toBeVisible();
		await expect.element(screen.getByText('Tab 2')).toBeVisible();
	});

	it('marks the active tab as selected', async () => {
		render(TabBar, {
			tabs,
			activeId: '2',
			onSelect: () => {},
			onAdd: () => {},
			onClose: () => {},
			onReorder: () => {}
		});
		const activeTab = document.body.querySelector('[role="tab"][aria-selected="true"]');
		expect(activeTab?.textContent).toContain('Tab 2');
	});

	it('calls onSelect when a tab is clicked', async () => {
		const onSelect = vi.fn();
		const screen = render(TabBar, {
			tabs,
			activeId: '1',
			onSelect,
			onAdd: () => {},
			onClose: () => {},
			onReorder: () => {}
		});
		await screen.getByText('Tab 2').click();
		expect(onSelect).toHaveBeenCalledWith('2');
	});

	it('calls onAdd when the new tab button is clicked', async () => {
		const onAdd = vi.fn();
		const screen = render(TabBar, {
			tabs,
			activeId: '1',
			onSelect: () => {},
			onAdd,
			onClose: () => {},
			onReorder: () => {}
		});
		await screen.getByRole('button', { name: 'New tab' }).click();
		expect(onAdd).toHaveBeenCalled();
	});

	it('opens a confirmation dialog when closing a tab, and calls onClose on confirm', async () => {
		const onClose = vi.fn();
		const screen = render(TabBar, {
			tabs,
			activeId: '1',
			onSelect: () => {},
			onAdd: () => {},
			onClose,
			onReorder: () => {}
		});
		await screen.getByRole('button', { name: 'Close Tab 1' }).click();

		const dialog = document.body.querySelector('[role="alertdialog"]');
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain('Tab 1');

		const confirmButton = dialog?.querySelector('[data-alert-dialog-action]') as HTMLElement;
		confirmButton.click();
		expect(onClose).toHaveBeenCalledWith('1');
	});

	it('does not call onClose when the dialog is cancelled', async () => {
		const onClose = vi.fn();
		const screen = render(TabBar, {
			tabs,
			activeId: '1',
			onSelect: () => {},
			onAdd: () => {},
			onClose,
			onReorder: () => {}
		});
		await screen.getByRole('button', { name: 'Close Tab 1' }).click();
		await screen.getByRole('button', { name: 'Cancel' }).click();
		expect(onClose).not.toHaveBeenCalled();
	});
});
