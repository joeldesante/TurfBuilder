import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MapPopup from './MapPopup.svelte';

describe('MapPopup', () => {
	describe('rendering', () => {
		it('renders the location name', async () => {
			const screen = render(MapPopup, { locationName: 'Volo Coffeehouse' });
			await expect.element(screen.getByText('Volo Coffeehouse')).toBeVisible();
		});

		it('does not render address line when street and locality are omitted', async () => {
			const screen = render(MapPopup, { locationName: 'Volo Coffeehouse' });
			const spans = screen.container.querySelectorAll('span');
			expect(spans).toHaveLength(1);
		});
	});

	describe('address', () => {
		it('renders street when provided', async () => {
			const screen = render(MapPopup, {
				locationName: 'Volo Coffeehouse',
				street: '112 S Wayne Ave'
			});
			await expect.element(screen.getByText('112 S Wayne Ave')).toBeVisible();
		});

		it('renders locality when provided', async () => {
			const screen = render(MapPopup, {
				locationName: 'Volo Coffeehouse',
				locality: 'Wayne, PA'
			});
			await expect.element(screen.getByText('Wayne, PA')).toBeVisible();
		});

		it('combines street and locality with a comma', async () => {
			const screen = render(MapPopup, {
				locationName: 'Volo Coffeehouse',
				street: '112 S Wayne Ave',
				locality: 'Wayne, PA'
			});
			await expect.element(screen.getByText('112 S Wayne Ave, Wayne, PA')).toBeVisible();
		});

		it('renders only street when locality is null', async () => {
			const screen = render(MapPopup, {
				locationName: 'Volo Coffeehouse',
				street: '112 S Wayne Ave',
				locality: null
			});
			await expect.element(screen.getByText('112 S Wayne Ave')).toBeVisible();
		});

		it('renders only locality when street is null', async () => {
			const screen = render(MapPopup, {
				locationName: 'Volo Coffeehouse',
				street: null,
				locality: 'Wayne, PA'
			});
			await expect.element(screen.getByText('Wayne, PA')).toBeVisible();
		});
	});
});
