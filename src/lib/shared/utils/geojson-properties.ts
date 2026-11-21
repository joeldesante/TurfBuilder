/** How many features are read when listing property names; enough to catch fields only some features have. */
const FEATURE_LIMIT = 500;

/** The property names found on the features of a GeoJSON object, in the order first seen. */
export function geojsonPropertyKeys(geojson: unknown): string[] {
	const root = geojson as { type?: unknown; features?: unknown; properties?: unknown } | null;
	let features: unknown[] = [];
	if (root?.type === 'FeatureCollection' && Array.isArray(root.features)) {
		features = root.features.slice(0, FEATURE_LIMIT);
	} else if (root?.type === 'Feature') {
		features = [root];
	}

	const keys = new Set<string>();
	for (const feature of features) {
		const properties = (feature as { properties?: unknown } | null)?.properties;
		if (!properties || typeof properties !== 'object' || Array.isArray(properties)) continue;
		for (const key of Object.keys(properties)) if (key !== '') keys.add(key);
	}
	return [...keys];
}
