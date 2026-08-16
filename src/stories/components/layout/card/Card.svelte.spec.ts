import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Card from './Card.svelte';

describe('Card', () => {
	test('renders', async () => {
		const screen = render(Card, {});
		// TODO: add assertions
		await expect
			.element(screen.container.firstElementChild as HTMLElement)
			.toBeInTheDocument();
	});
});
