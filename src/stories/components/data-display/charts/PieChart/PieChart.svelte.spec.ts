import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PieChart from './PieChart.svelte';

const data = [
	{ label: 'Supportive', value: 42 },
	{ label: 'Unsupportive', value: 18 }
];

describe('PieChart', () => {
	it('renders an svg element', async () => {
		const { container } = render(PieChart, { data });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
	});

	it('renders one path per slice', async () => {
		const { container } = render(PieChart, { data });
		const paths = container.querySelectorAll('path');
		expect(paths.length).toBe(data.length);
	});

	it('renders legend when enabled', async () => {
		const screen = render(PieChart, { data, legend: true });
		await expect.element(screen.getByText('Supportive')).toBeVisible();
		await expect.element(screen.getByText('Unsupportive')).toBeVisible();
	});

	it('does not render legend by default', async () => {
		const { container } = render(PieChart, { data });
		const legendItems = container.querySelectorAll('.rounded-full');
		expect(legendItems.length).toBe(0);
	});

	it('renders as donut when innerRadius is set', async () => {
		const { container } = render(PieChart, { data, innerRadius: 60 });
		const path = container.querySelector('path');
		expect(path?.getAttribute('d')).toContain('M');
	});
});
