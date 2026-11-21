import type { BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A minimal MapLibre style with no tile sources: a plain background. The app
 * themes it like the real positron style (getMapStyle maps over its layers),
 * so map pages, markers, and drawing all work without any tiles.
 */
const STYLE = readFileSync(
	fileURLToPath(new URL('./map/styles/positron', import.meta.url)),
	'utf8'
);

/**
 * Answers every request to tiles.openfreemap.org locally: the style with the
 * stub above, and tiles, sprites, and glyphs with an empty 204, which MapLibre
 * treats as nothing to draw. Tests then never depend on the tile service.
 */
export async function stubMapTiles(context: BrowserContext): Promise<void> {
	await context.route('https://tiles.openfreemap.org/**', (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname.startsWith('/styles/')) {
			return route.fulfill({ status: 200, contentType: 'application/json', body: STYLE });
		}
		return route.fulfill({ status: 204, body: '' });
	});
}
