import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MapMarker from './MapMarker.svelte';

describe('MapMarker', () => {
	describe('rendering', () => {
		it('renders with role="img" and default aria-label', async () => {
			const screen = render(MapMarker);
			const marker = screen.getByRole('img', { name: 'unvisited location marker' });
			await expect.element(marker).toBeVisible();
		});

		it('includes an SVG pin shape', async () => {
			const screen = render(MapMarker);
			const svg = screen.container.querySelector('svg');
			expect(svg).not.toBeNull();
			const path = svg?.querySelector('path');
			expect(path).not.toBeNull();
		});
	});

	describe('variants', () => {
		it('sets aria-label to include variant name', async () => {
			const screen = render(MapMarker, { variant: 'contacted' });
			const marker = screen.getByRole('img', { name: 'contacted location marker' });
			await expect.element(marker).toBeVisible();
		});

		it('applies unvisited fill class by default', async () => {
			const screen = render(MapMarker);
			const path = screen.container.querySelector('path');
			expect(path?.classList.contains('fill-location-unvisited')).toBe(true);
		});

		it('applies contacted fill class', async () => {
			const screen = render(MapMarker, { variant: 'contacted' });
			const path = screen.container.querySelector('path');
			expect(path?.classList.contains('fill-location-contacted')).toBe(true);
		});

		it('applies no-contact fill class', async () => {
			const screen = render(MapMarker, { variant: 'no-contact' });
			const path = screen.container.querySelector('path');
			expect(path?.classList.contains('fill-location-no-contact')).toBe(true);
		});

		it('applies hostile fill class', async () => {
			const screen = render(MapMarker, { variant: 'hostile' });
			const path = screen.container.querySelector('path');
			expect(path?.classList.contains('fill-location-hostile')).toBe(true);
		});
	});

	describe('icons', () => {
		it('does not render an icon for unvisited variant', async () => {
			const screen = render(MapMarker, { variant: 'unvisited' });
			const foreignObject = screen.container.querySelector('foreignObject');
			expect(foreignObject).toBeNull();
		});

		it('renders an icon for contacted variant', async () => {
			const screen = render(MapMarker, { variant: 'contacted' });
			const foreignObject = screen.container.querySelector('foreignObject');
			expect(foreignObject).not.toBeNull();
		});

		it('does not render an icon for no-contact variant', async () => {
			const screen = render(MapMarker, { variant: 'no-contact' });
			const foreignObject = screen.container.querySelector('foreignObject');
			expect(foreignObject).toBeNull();
		});

		it('renders an icon for hostile variant', async () => {
			const screen = render(MapMarker, { variant: 'hostile' });
			const foreignObject = screen.container.querySelector('foreignObject');
			expect(foreignObject).not.toBeNull();
		});
	});

	describe('selection', () => {
		it('applies scale-100 when not selected', async () => {
			const screen = render(MapMarker);
			const marker = screen.container.querySelector('div[role="img"]');
			expect(marker?.classList.contains('scale-100')).toBe(true);
		});

		it('applies scale-125 when selected', async () => {
			const screen = render(MapMarker, { isSelected: true });
			const marker = screen.container.querySelector('div[role="img"]');
			expect(marker?.classList.contains('scale-125')).toBe(true);
		});
	});
});
