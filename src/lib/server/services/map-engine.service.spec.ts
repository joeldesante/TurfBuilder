import { describe, it, expect, vi, beforeEach } from 'vitest';

const { page, browser, launchBrowser, getMapStyle } = vi.hoisted(() => {
	const page = {
		setViewport: vi.fn(),
		setContent: vi.fn(),
		addStyleTag: vi.fn(),
		addScriptTag: vi.fn(),
		evaluate: vi.fn(),
		waitForFunction: vi.fn(),
		screenshot: vi.fn()
	};
	const browser = { newPage: vi.fn(async () => page), close: vi.fn() };
	return {
		page,
		browser,
		launchBrowser: vi.fn(async () => browser),
		getMapStyle: vi.fn(async () => ({ version: 8 }))
	};
});

vi.mock('./browser', () => ({ launchBrowser }));
vi.mock('$lib/map-style', () => ({ getMapStyle }));

import { renderMap } from './map-engine.service';

const SIZE = { width: 1400, height: 720 };

/** The arguments handed to the in-page map script: [style, bounds, boundary, points]. */
function mapArgs() {
	return page.evaluate.mock.calls[0].slice(1);
}

beforeEach(() => {
	vi.clearAllMocks();
	page.screenshot.mockResolvedValue(new Uint8Array([255, 216, 255]));
});

describe('renderMap', () => {
	it('refuses to render when there is nothing to frame, without starting Chrome', async () => {
		await expect(renderMap(SIZE, { points: [] })).rejects.toThrow(
			'needs a boundary or at least one point'
		);
		expect(launchBrowser).not.toHaveBeenCalled();
	});

	it('frames the map on the boundary and the points together', async () => {
		const boundary = {
			type: 'Polygon' as const,
			coordinates: [
				[
					[-75.2, 39.9],
					[-75.1, 39.9],
					[-75.1, 40.0],
					[-75.2, 39.9]
				]
			]
		};

		await renderMap(SIZE, { boundary, points: [{ longitude: -75.3, latitude: 40.1 }] });

		const [, bounds] = mapArgs();
		expect(bounds).toEqual([
			[-75.3, 39.9],
			[-75.1, 40.1]
		]);
	});

	it('handles a multipolygon boundary', async () => {
		const boundary = {
			type: 'MultiPolygon' as const,
			coordinates: [
				[
					[
						[1, 1],
						[2, 1],
						[2, 2],
						[1, 1]
					]
				],
				[
					[
						[5, 5],
						[6, 5],
						[6, 6],
						[5, 5]
					]
				]
			]
		};

		await renderMap(SIZE, { boundary });

		const [, bounds] = mapArgs();
		expect(bounds).toEqual([
			[1, 1],
			[6, 6]
		]);
	});

	it('passes point labels through so markers can be numbered', async () => {
		const points = [{ longitude: -75.1, latitude: 39.9, label: '1' }];

		await renderMap(SIZE, { points });

		const [, , , passed] = mapArgs();
		expect(passed).toEqual(points);
	});

	it('renders at the requested size and returns the screenshot', async () => {
		const jpeg = await renderMap(SIZE, { points: [{ longitude: 0, latitude: 0 }] });

		expect(page.setViewport).toHaveBeenCalledWith(SIZE);
		expect(page.screenshot).toHaveBeenCalledWith({ type: 'jpeg', quality: 85 });
		expect(jpeg).toEqual(new Uint8Array([255, 216, 255]));
		expect(browser.close).toHaveBeenCalledOnce();
	});

	it('closes the browser even when rendering fails', async () => {
		page.waitForFunction.mockRejectedValue(new Error('map never went idle'));

		await expect(renderMap(SIZE, { points: [{ longitude: 0, latitude: 0 }] })).rejects.toThrow(
			'map never went idle'
		);
		expect(browser.close).toHaveBeenCalledOnce();
	});
});
