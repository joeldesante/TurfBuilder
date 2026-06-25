import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import * as Plot from '@observablehq/plot';
import LineChart from './LineChart.svelte';

const data = [
	{ week: 0, doors: 10 },
	{ week: 1, doors: 40 },
	{ week: 2, doors: 25 }
];

const baseOptions: Plot.PlotOptions = {
	marks: [Plot.lineY(data, { x: 'week', y: 'doors' })]
};

describe('LineChart', () => {
	it('renders an svg element', async () => {
		const { container } = render(LineChart, { options: baseOptions });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
	});

	it('renders a line path', async () => {
		const { container } = render(LineChart, { options: baseOptions });
		const path = container.querySelector('path');
		expect(path).not.toBeNull();
	});

	it('renders with time scale', async () => {
		const timeData = [
			{ date: new Date('2024-01-01'), value: 10 },
			{ date: new Date('2024-02-01'), value: 40 }
		];
		const { container } = render(LineChart, {
			options: { marks: [Plot.lineY(timeData, { x: 'date', y: 'value' })] }
		});
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
	});

	it('applies width and height options', async () => {
		const { container } = render(LineChart, {
			options: { ...baseOptions, width: 800, height: 400 }
		});
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('800');
		expect(svg?.getAttribute('height')).toBe('400');
	});
});
