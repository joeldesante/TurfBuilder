import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LoadingScreen from './LoadingScreen.svelte';

describe('LoadingScreen', () => {
	it('renders a status region labelled Loading', async () => {
		const { getByRole } = render(LoadingScreen, { delay: 0 });
		await expect.element(getByRole('status', { name: 'Loading' })).toBeVisible();
	});

	it('renders the logo', async () => {
		const { getByRole } = render(LoadingScreen, { delay: 0 });
		await expect.element(getByRole('img', { name: 'Logo' })).toBeVisible();
	});

	it('renders the spinner', async () => {
		const { getByRole } = render(LoadingScreen, { delay: 0 });
		const status = getByRole('status', { name: 'Loading' });
		await expect.element(status).toBeVisible();
		const spinner = status.element().querySelector('.animate-spin');
		expect(spinner).toBeTruthy();
	});

	it('passes logoWidth to the logo', async () => {
		const { getByRole } = render(LoadingScreen, { delay: 0, logoWidth: 80 });
		const logo = getByRole('img', { name: 'Logo' });
		await expect.element(logo).toHaveStyle({ width: '80px' });
	});

	it('is hidden until the delay elapses', async () => {
		const { container, getByRole } = render(LoadingScreen, { delay: 100 });
		expect(container.querySelector('[role="status"]')).toBeNull();
		await expect.element(getByRole('status', { name: 'Loading' })).toBeVisible();
	});
});
