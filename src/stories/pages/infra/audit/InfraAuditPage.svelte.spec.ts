import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraAuditPage from './InfraAuditPage.svelte';
import { auditPage } from './fixtures';

describe('InfraAuditPage', () => {
	test('lists each change with who made it and links users and organizations', async () => {
		const { getByRole } = render(InfraAuditPage, { props: { page: auditPage, filters: {}, onfilter: vi.fn() } });

		await expect.element(getByRole('list').getByText('Suspended a user')).toBeVisible();
		await expect.element(getByRole('link', { name: 'View user' })).toHaveAttribute('href', `/infra/users/${auditPage.items[0].targetId}`);
		await expect.element(getByRole('link', { name: 'View organization' })).toHaveAttribute('href', `/infra/orgs/${auditPage.items[1].targetId}`);
	});

	test('filters by kind of change as soon as one is picked, keeping the rest', async () => {
		const onfilter = vi.fn();
		const { getByRole } = render(InfraAuditPage, { props: { page: auditPage, filters: { targetType: 'user' }, onfilter } });

		await getByRole('combobox', { name: 'Change' }).selectOptions('user.suspend');

		expect(onfilter).toHaveBeenCalledWith({ targetType: 'user', action: 'user.suspend' });
	});

	test('applies dates together', async () => {
		const onfilter = vi.fn();
		const { getByLabelText, getByRole } = render(InfraAuditPage, { props: { page: auditPage, filters: {}, onfilter } });

		await getByLabelText('From', { exact: true }).fill('2026-10-01');
		await getByLabelText('To', { exact: true }).fill('2026-10-19');
		await getByRole('button', { name: 'Apply dates' }).click();

		expect(onfilter).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-19' });
	});

	test('says so when nothing matches', async () => {
		const { getByText } = render(InfraAuditPage, { props: { page: { ...auditPage, items: [], totalCount: 0 }, filters: {}, onfilter: vi.fn() } });

		await expect.element(getByText('No changes match.')).toBeVisible();
	});
});
