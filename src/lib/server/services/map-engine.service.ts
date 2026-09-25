import { createRequire } from 'node:module';
import { getMapStyle } from '$lib/map-style';
import { launchBrowser } from './browser';

const require = createRequire(import.meta.url);

/**
 * Headless Chrome has no GPU, so WebGL has to run in software. Puppeteer's
 * own Chrome (local dev) bundles SwiftShader for that; Alpine's chromium (the
 * Docker images) does not, and renders through Mesa's llvmpipe via EGL instead.
 */
const WEBGL_ARGS =
	process.platform === 'linux'
		? ['--use-angle=gl-egl', '--ignore-gpu-blocklist']
		: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export interface MapDimensions {
	width: number;
	height: number;
}

export interface MapDetails {
	/** Outline drawn over the map, typically a turf. */
	boundary?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
	/** Drawn as dots, or as numbered markers when a point has a label. */
	points?: { longitude: number; latitude: number; label?: string }[];
	dark?: boolean;
}

/** Renders a static map framed to fit the boundary and points, as a JPEG. */
export async function renderMap(
	dimensions: MapDimensions,
	details: MapDetails
): Promise<Uint8Array> {
	const points = details.points ?? [];
	// Flattened to [lng, lat, lng, lat, ...] so Polygon and MultiPolygon take the same path.
	const flat = [
		...((details.boundary?.coordinates.flat(Infinity) as number[] | undefined) ?? []),
		...points.flatMap((p) => [p.longitude, p.latitude])
	];
	if (flat.length === 0)
		throw new Error('renderMap needs a boundary or at least one point to frame');

	const lngs = flat.filter((_, i) => i % 2 === 0);
	const lats = flat.filter((_, i) => i % 2 === 1);
	const bounds = [
		[Math.min(...lngs), Math.min(...lats)],
		[Math.max(...lngs), Math.max(...lats)]
	];

	const style = await getMapStyle(details.dark ?? false);

	const browser = await launchBrowser(WEBGL_ARGS);
	try {
		const page = await browser.newPage();
		await page.setViewport(dimensions);
		await page.setContent(
			'<body style="margin:0"><div id="map" style="width:100vw;height:100vh"></div></body>'
		);
		await page.addStyleTag({ path: require.resolve('maplibre-gl/dist/maplibre-gl.css') });
		await page.addScriptTag({ path: require.resolve('maplibre-gl/dist/maplibre-gl.js') });

		await page.evaluate(
			(style, bounds, boundary, points) => {
				const w = window as unknown as {
					maplibregl: typeof import('maplibre-gl');
					mapIdle: boolean;
				};
				const map = new w.maplibregl.Map({
					container: 'map',
					style,
					bounds,
					fitBoundsOptions: { padding: 40, maxZoom: 17 },
					interactive: false,
					fadeDuration: 0,
					attributionControl: { compact: false }
				});

				map.on('load', () => {
					if (boundary) {
						map.addSource('boundary', { type: 'geojson', data: boundary });
						map.addLayer({
							id: 'boundary-fill',
							type: 'fill',
							source: 'boundary',
							paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 }
						});
						map.addLayer({
							id: 'boundary-line',
							type: 'line',
							source: 'boundary',
							paint: { 'line-color': '#10b981', 'line-width': 2, 'line-dasharray': [2, 1] }
						});
					}
					map.addSource('points', {
						type: 'geojson',
						data: {
							type: 'FeatureCollection',
							features: points.map((p) => ({
								type: 'Feature',
								properties: { label: p.label ?? '' },
								geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
							}))
						}
					});
					// Numbered markers are near-black so the white numbers stay
					// legible when the page is printed in grayscale.
					const labelled = points.some((p) => p.label);
					map.addLayer({
						id: 'points',
						type: 'circle',
						source: 'points',
						paint: {
							'circle-radius': labelled ? 9 : 5,
							'circle-color': labelled ? '#111827' : '#10b981',
							'circle-stroke-width': 1.5,
							'circle-stroke-color': '#ffffff'
						}
					});
					if (labelled) {
						map.addLayer({
							id: 'point-labels',
							type: 'symbol',
							source: 'points',
							layout: {
								'text-field': ['get', 'label'],
								'text-font': ['Noto Sans Bold'],
								'text-size': 11,
								// Every marker keeps its number, even where markers overlap.
								'text-allow-overlap': true,
								'text-ignore-placement': true
							},
							paint: { 'text-color': '#ffffff' }
						});
					}
					map.once('idle', () => (w.mapIdle = true));
				});
			},
			style as never,
			bounds as [[number, number], [number, number]],
			details.boundary ?? null,
			points
		);

		await page.waitForFunction('window.mapIdle === true');
		return await page.screenshot({ type: 'jpeg', quality: 85 });
	} finally {
		await browser.close();
	}
}
