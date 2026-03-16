import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Spinner from './Spinner.svelte';

describe('Spinner', () => {
	it('renders an element with the animate-spin class', async () => {
		const { container } = render(Spinner);
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
		expect(svg!.classList.contains('animate-spin')).toBe(true);
	});

	it('is aria-hidden by default', async () => {
		const { container } = render(Spinner);
		const svg = container.querySelector('svg');
		expect(svg!.getAttribute('aria-hidden')).toBe('true');
	});

	it('applies a custom class', async () => {
		const { container } = render(Spinner, { class: 'text-primary' });
		const svg = container.querySelector('svg');
		expect(svg!.classList.contains('text-primary')).toBe(true);
	});

	it('passes the size prop to the icon', async () => {
		const { container } = render(Spinner, { size: 32 });
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});
});
