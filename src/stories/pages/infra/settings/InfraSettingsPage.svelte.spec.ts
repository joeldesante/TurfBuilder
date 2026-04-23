import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import InfraSettingsPage from './InfraSettingsPage.svelte';

const defaultSetting = {
	key: 'organizations.allow_creation',
	value: 'true',
	description: 'Whether users can create new organizations.'
};

describe('InfraSettingsPage', () => {
	describe('rendering', () => {
		it('renders the page heading', async () => {
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle: async () => {} });
			await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('System Settings');
		});

		it('renders a setting row with its label', async () => {
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle: async () => {} });
			await expect.element(page.getByText('Allow Organization Creation')).toBeVisible();
		});

		it('renders the setting description', async () => {
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle: async () => {} });
			await expect.element(page.getByText('Whether users can create new organizations.')).toBeVisible();
		});

		it('renders a toggle for boolean settings', async () => {
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle: async () => {} });
			await expect.element(page.getByRole('switch')).toBeVisible();
		});

		it('toggle is checked when value is true', async () => {
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle: async () => {} });
			await expect.element(page.getByRole('switch')).toBeChecked();
		});

		it('toggle is unchecked when value is false', async () => {
			render(InfraSettingsPage, {
				settings: [{ ...defaultSetting, value: 'false' }],
				onToggle: async () => {}
			});
			await expect.element(page.getByRole('switch')).not.toBeChecked();
		});

		it('shows empty state when no settings provided', async () => {
			render(InfraSettingsPage, { settings: [], onToggle: async () => {} });
			await expect.element(page.getByText('No system settings found.')).toBeVisible();
		});
	});

	describe('interaction', () => {
		it('calls onToggle with the setting key and new boolean value when toggled', async () => {
			const onToggle = vi.fn().mockResolvedValue(undefined);
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle });

			await page.getByRole('switch').click();

			expect(onToggle).toHaveBeenCalledWith('organizations.allow_creation', false);
		});

		it('shows an error message when onToggle rejects', async () => {
			const onToggle = vi.fn().mockRejectedValue(new Error('Network error'));
			render(InfraSettingsPage, { settings: [defaultSetting], onToggle });

			await page.getByRole('switch').click();

			await expect.element(page.getByText('Network error')).toBeVisible();
		});
	});
});
