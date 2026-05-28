import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import MemberDetailPage from './MemberDetailPage.svelte';

const defaultProps = {
	userId: 'user-1',
	name: 'Jane Smith',
	email: 'jane@example.com',
	orgSlug: 'my-org',
	permissions: [
		{ id: 'p1', key: 'turf.read', label: 'View Turfs', group: 'Turfs', description: null, value: null },
		{ id: 'p2', key: 'turf.create', label: 'Cut New Turfs', group: 'Turfs', description: null, value: true },
	],
	onSetPermission: async () => {}
};

describe('MemberDetailPage', () => {
	it('renders the member name as heading', async () => {
		render(MemberDetailPage, defaultProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Jane Smith');
	});

	it('renders permission labels', async () => {
		render(MemberDetailPage, defaultProps);
		await expect.element(page.getByText('View Turfs')).toBeVisible();
	});

	it('shows Inherited for null value', async () => {
		render(MemberDetailPage, defaultProps);
		await expect.element(page.getByRole('button', { name: 'Inherited' })).toBeVisible();
	});

	it('shows Granted for true value', async () => {
		render(MemberDetailPage, defaultProps);
		await expect.element(page.getByRole('button', { name: 'Granted' })).toBeVisible();
	});

	it('calls onSetPermission when badge is clicked', async () => {
		const onSetPermission = vi.fn().mockResolvedValue(undefined);
		render(MemberDetailPage, { ...defaultProps, onSetPermission });

		await page.getByRole('button', { name: 'Inherited' }).click();

		expect(onSetPermission).toHaveBeenCalledWith('p1', true);
	});
});
