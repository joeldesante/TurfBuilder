import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import PluginsPage from './PluginsPage.svelte';

const samplePlugins = [
	{
		slug: 'voter-file',
		name: 'Voter File',
		description: 'Import and match voter file data against canvassing results.',
		version: '1.0.0',
		installed: true,
		enabled: true
	},
	{
		slug: 'phone-bank',
		name: 'Phone Bank',
		description: 'Manage phone banking campaigns.',
		version: '0.9.0',
		installed: false,
		enabled: false
	}
];

const baseProps = {
	plugins: samplePlugins,
	onToggle: vi.fn().mockResolvedValue(undefined)
};

describe('PluginsPage', () => {
	it('renders the page heading', async () => {
		render(PluginsPage, baseProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Plugins');
	});

	it('renders each plugin name', async () => {
		render(PluginsPage, baseProps);
		await expect.element(page.getByText('Voter File')).toBeVisible();
		await expect.element(page.getByText('Phone Bank')).toBeVisible();
	});

	it('renders each plugin description', async () => {
		render(PluginsPage, baseProps);
		await expect
			.element(page.getByText('Import and match voter file data against canvassing results.'))
			.toBeVisible();
	});

	it('renders each plugin version', async () => {
		render(PluginsPage, baseProps);
		await expect.element(page.getByText('1.0.0')).toBeVisible();
		await expect.element(page.getByText('0.9.0')).toBeVisible();
	});

	it('shows Active badge for installed and enabled plugins', async () => {
		render(PluginsPage, baseProps);
		await expect.element(page.getByText('Active')).toBeVisible();
	});

	it('does not show Active badge for disabled plugins', async () => {
		render(PluginsPage, { ...baseProps, plugins: [samplePlugins[1]] });
		await expect.element(page.getByText('Active')).not.toBeInTheDocument();
	});

	it('renders a toggle for each plugin', async () => {
		render(PluginsPage, baseProps);
		const switches = page.getByRole('switch');
		await expect.element(switches.first()).toBeVisible();
	});

	it('calls onToggle with slug and new state when toggled', async () => {
		const onToggle = vi.fn().mockResolvedValue(undefined);
		render(PluginsPage, { ...baseProps, onToggle });
		await page.getByRole('switch', { name: 'Enable Phone Bank' }).click();
		expect(onToggle).toHaveBeenCalledWith('phone-bank', true);
	});

	it('shows empty state when no plugins', async () => {
		render(PluginsPage, { ...baseProps, plugins: [] });
		await expect.element(page.getByText('No plugins are available.')).toBeVisible();
	});
});
