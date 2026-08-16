import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LineChart from './LineChart.svelte';
import type { Series } from './LineChart.svelte';

const numericSeries: Series[] = [
	{
		name: 'Doors Knocked',
		color: '#4f46e5',
		data: [
			{ date: new Date('2024-01-01T00:00:00Z'), qty: 10 },
			{ date: new Date('2024-01-08T00:00:00Z'), qty: 40 },
			{ date: new Date('2024-01-15T00:00:00Z'), qty: 25 }
		]
	}
];

describe('LineChart', () => {
	it('renders an svg element', async () => {
		const { container } = render(LineChart, { series: numericSeries });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
	});

	it('renders a line path', async () => {
		const { container } = render(LineChart, { series: numericSeries });
		const path = container.querySelector('path');
		expect(path).not.toBeNull();
	});

	it('renders with a time scale across a wider date range', async () => {
		const timeSeries: Series[] = [
			{
				name: 'Responses',
				color: '#16a34a',
				data: [
					{ date: new Date('2024-01-01T00:00:00Z'), qty: 10 },
					{ date: new Date('2024-06-01T00:00:00Z'), qty: 40 }
				]
			}
		];
		const { container } = render(LineChart, { series: timeSeries, granularity: 'month' });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(container.textContent).toContain('Jan 2024');
	});

	it('applies the chart default width and height', async () => {
		const { container } = render(LineChart, { series: numericSeries });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('700');
		expect(svg?.getAttribute('height')).toBe('300');
	});
});
