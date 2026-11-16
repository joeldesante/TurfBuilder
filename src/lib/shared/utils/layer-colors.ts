/** The colors a map layer can be drawn in. Picked from a fixed list so layers stay easy to tell apart. */
export const LAYER_COLORS = [
	{ name: 'Red', value: '#e63946' },
	{ name: 'Orange', value: '#f4801f' },
	{ name: 'Yellow', value: '#f2c230' },
	{ name: 'Green', value: '#2a9d4b' },
	{ name: 'Teal', value: '#1fb5ad' },
	{ name: 'Blue', value: '#2f6fed' },
	{ name: 'Purple', value: '#8a4fd6' },
	{ name: 'Pink', value: '#e4569c' }
] as const;

export type LayerColor = (typeof LAYER_COLORS)[number]['value'];

/** The color for the nth layer, cycling through the list. */
export function defaultLayerColor(index: number): LayerColor {
	return LAYER_COLORS[index % LAYER_COLORS.length].value;
}
