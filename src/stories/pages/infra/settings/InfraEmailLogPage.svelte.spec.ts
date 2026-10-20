import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraEmailLogPage from './InfraEmailLogPage.svelte';
import { emailLogPage } from './fixtures';

const templates = ['auth.reset_password', 'auth.verify_email'];

describe('InfraEmailLogPage', () => {
	test('lists the emails with their outcome', async () => {
		const { getByRole } = render(InfraEmailLogPage, { props: { page: emailLogPage, filters: {}, templates, onfilter: vi.fn() } });

		await expect.element(getByRole('table').getByText('ada@example.com')).toBeVisible();
		await expect.element(getByRole('table').getByText('Failed')).toBeVisible();
	});

	test('filters by status as soon as one is picked', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraEmailLogPage, { props: { page: emailLogPage, filters: {}, templates, onfilter } });

		await getByRole('combobox', { name: 'Status' }).selectOptions('failed');

		expect(onfilter).toHaveBeenCalledWith({ status: 'failed', template: undefined, recipient: undefined });
	});

	test('keeps the other filters when one changes', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraEmailLogPage, { props: { page: emailLogPage, filters: { status: 'failed' }, templates, onfilter } });

		await getByRole('combobox', { name: 'Template' }).selectOptions('auth.verify_email');

		expect(onfilter).toHaveBeenCalledWith({ status: 'failed', template: 'auth.verify_email', recipient: undefined });
	});

	test('searches by address', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraEmailLogPage, { props: { page: emailLogPage, filters: {}, templates, onfilter } });

		await getByRole('searchbox', { name: 'Search by address' }).fill('ada@example.com');
		await getByRole('button', { name: 'Search' }).click();

		expect(onfilter).toHaveBeenCalledWith({ status: undefined, template: undefined, recipient: 'ada@example.com' });
	});
});
