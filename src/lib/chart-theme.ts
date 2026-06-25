import type * as Plot from '@observablehq/plot';

export const chartTheme: Plot.PlotOptions = {
	style: {
		background: 'transparent',
		color: 'var(--on-surface)',
		fontFamily: 'Figtree, sans-serif',
		fontSize: '12px'
	},
	x: {
		line: true
	},
	y: {
		line: true,
		grid: true
	}
};

export const tipStyles = {
	fill: 'var(--inverse-surface)',
	stroke: 'none',
	fontFamily: 'Figtree, sans-serif',
	fontSize: 12,
	r: 8
} satisfies Record<string, unknown>;
