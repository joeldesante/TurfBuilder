import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Separator from './Separator.svelte';

describe('Separator', () => {
	it('renders with horizontal orientation by default', async () => {
		const screen = render(Separator);
		const el = screen.container.querySelector('[data-orientation="horizontal"]');
		expect(el).not.toBeNull();
	});

	it('renders with vertical orientation when specified', async () => {
		const screen = render(Separator, { orientation: 'vertical' });
		const el = screen.container.querySelector('[data-orientation="vertical"]');
		expect(el).not.toBeNull();
	});

	it('is hidden from assistive technology when decorative', async () => {
		const screen = render(Separator, { decorative: true });
		const el = screen.container.querySelector('[aria-hidden="true"]');
		expect(el).not.toBeNull();
	});
});
