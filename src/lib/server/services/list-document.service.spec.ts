import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// renderMap is the shared renderer's render(size, details); closeRenderer its close().
const {
	mockClient,
	generatePDF,
	uploadObject,
	renderMap,
	closeRenderer,
	openMapRenderer,
	StorageNotConfiguredError
} = vi.hoisted(() => {
	const renderMap = vi.fn();
	const closeRenderer = vi.fn(async () => {});
	return {
		StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
		mockClient: { query: vi.fn(), release: vi.fn() },
		generatePDF: vi.fn(),
		uploadObject: vi.fn(),
		renderMap,
		closeRenderer,
		openMapRenderer: vi.fn(async () => ({ render: renderMap, close: closeRenderer }))
	};
});

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('./pdf-engine.service', () => ({ generatePDF }));
vi.mock('./map-engine.service', () => ({ openMapRenderer }));
vi.mock('$lib/server/storage', () => ({ uploadObject, StorageNotConfiguredError }));

import {
	generateListDocument,
	GENERATION_TIMEOUT_MS,
	GENERIC_FAILURE
} from './list-document.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const job = {
	orgId: ORG,
	documentId: 'doc-1',
	listId: 'list-1',
	storageKey: `orgs/${ORG}/lists/list-1/documents/doc-1.pdf`
};

const TURF_BOUNDS = {
	type: 'Polygon',
	coordinates: [
		[
			[-75.2, 39.9],
			[-75.1, 39.9],
			[-75.1, 40],
			[-75.2, 39.9]
		]
	]
};

/** A location row as the loader's queries return it; any part can be missing. */
interface Row {
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	latitude: number | null;
	longitude: number | null;
}

function location(name: string, address: string, coords = true): Row {
	return {
		name,
		address_line_1: address,
		city: 'Springfield',
		state_or_region: 'PA',
		postal_code: '19064',
		latitude: coords ? 39.95 : null,
		longitude: coords ? -75.15 : null
	};
}

const DEFAULT_LIST = {
	name: 'Downtown',
	entity_type: 'locations',
	// Midday UTC, so the date reads Oct 8 in any timezone the tests run in.
	expires_at: new Date('2026-10-08T12:00:00Z')
};

const TURF_2_BOUNDS = {
	...TURF_BOUNDS,
	coordinates: [
		[
			[-75, 39],
			[-74.9, 39],
			[-74.9, 39.1],
			[-75, 39]
		]
	]
};

/** Answers the loader's queries by table; everything else (BEGIN, UPDATE, ...) succeeds. */
function mockDatabase(
	options: {
		list?: { name: string; entity_type: string; expires_at: Date } | null;
		entries?: Row[];
		turfs?: { id: string; code: string; bounds: string | null }[];
		turfLocations?: (Row & { turf_id: string })[];
		/** deleted_at of this document when its outcome is recorded; set if a newer one replaced it. */
		replacedAt?: Date | null;
	} = {}
) {
	const {
		list = DEFAULT_LIST,
		entries = [
			location('Quick Mart', '1 Main St'),
			location('Hardware', '2 Main St'),
			location('No Pin Cafe', '3 Main St', false)
		],
		turfs = [
			{ id: 'turf-1', code: 'KX7-42B', bounds: JSON.stringify(TURF_BOUNDS) },
			{ id: 'turf-2', code: 'QP3-19A', bounds: JSON.stringify(TURF_2_BOUNDS) }
		],
		turfLocations = [
			{ turf_id: 'turf-1', ...location('Hardware', '2 Main St') },
			{ turf_id: 'turf-2', ...location('No Pin Cafe', '3 Main St', false) },
			{ turf_id: 'turf-1', ...location('Quick Mart', '1 Main St') }
		],
		replacedAt = null
	} = options;

	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM universe.list\n')) return { rows: list ? [list] : [] };
		if (sql.includes('FROM universe.list_entry')) return { rows: entries };
		if (sql.includes('FROM universe.turf\n')) return { rows: turfs };
		if (sql.includes('FROM universe.turf_location')) return { rows: turfLocations };
		if (sql.includes('SET status')) return { rows: [{ deleted_at: replacedAt }], rowCount: 1 };
		return { rows: [], rowCount: 1 };
	});
}

/** The loader's SELECTs, as [sql, params]. */
function loaderQueries() {
	return mockClient.query.mock.calls.filter((c) =>
		/FROM universe\.(list|list_entry|turf|turf_location)\b/.test(String(c[0]))
	);
}

function renderedData() {
	return generatePDF.mock.calls[0][1];
}

function statusUpdate() {
	const call = mockClient.query.mock.calls.find((c) => String(c[0]).includes('SET status'));
	return call?.[1] as unknown[] | undefined;
}

/** Params of the query that brings back the documents this one replaced, if it ran. */
function restoreQuery() {
	const call = mockClient.query.mock.calls.find((c) =>
		String(c[0]).includes('SET deleted_at = NULL')
	);
	return call?.[1] as unknown[] | undefined;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	mockDatabase();
	renderMap.mockResolvedValue(new Uint8Array([255, 216, 255]));
	generatePDF.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
	uploadObject.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('generateListDocument', () => {
	it('uploads the pdf to the reserved key and marks it ready', async () => {
		await generateListDocument(job);

		expect(generatePDF).toHaveBeenCalledWith(
			expect.stringContaining('{{list.name}}'),
			expect.any(Object),
			{ signal: expect.any(AbortSignal) }
		);
		expect(uploadObject).toHaveBeenCalledWith(
			job.storageKey,
			expect.any(Uint8Array),
			'application/pdf'
		);
		expect(statusUpdate()).toEqual(['ready', null, 'doc-1', ORG]);
	});

	it('numbers the locations and formats their addresses for the template', async () => {
		await generateListDocument(job);

		const data = renderedData();
		expect(data.list).toEqual({ name: 'Downtown' });
		expect(data.expires).toEqual({
			date: 'Oct 8, 2026',
			time: expect.stringMatching(/^\d{1,2}:\d{2}\s?[AP]M$/),
			timezone: expect.any(String)
		});
		expect(data.locations).toEqual([
			{ number: 1, name: 'Quick Mart', address: '1 Main St, Springfield, PA 19064' },
			{ number: 2, name: 'Hardware', address: '2 Main St, Springfield, PA 19064' },
			{ number: 3, name: 'No Pin Cafe', address: '3 Main St, Springfield, PA 19064' }
		]);
	});

	it('numbers each turf from 1 and embeds its map framed on the turf boundary', async () => {
		await generateListDocument(job);

		const [turf] = renderedData().turfs;
		expect(turf.code).toBe('KX7-42B');
		expect(turf.locations.map((l: { number: number }) => l.number)).toEqual([1, 2]);
		expect(turf.map).toMatch(/^data:image\/jpeg;base64,/);
		expect(renderMap).toHaveBeenCalledWith(expect.any(Object), {
			boundary: TURF_BOUNDS,
			points: [
				{ latitude: 39.95, longitude: -75.15, label: '1' },
				{ latitude: 39.95, longitude: -75.15, label: '2' }
			]
		});
	});

	it('gives each turf only its own locations, numbered from 1 again', async () => {
		await generateListDocument(job);

		const turfs = renderedData().turfs;
		expect(turfs.map((t: { code: string }) => t.code)).toEqual(['KX7-42B', 'QP3-19A']);
		expect(turfs[0].locations.map((l: { name: string }) => l.name)).toEqual([
			'Hardware',
			'Quick Mart'
		]);
		expect(turfs[1].locations).toEqual([
			{ number: 1, name: 'No Pin Cafe', address: '3 Main St, Springfield, PA 19064' }
		]);
	});

	// A turf whose only location has no pin still has its boundary to frame.
	it('draws a turf map from the boundary alone when no location has coordinates', async () => {
		await generateListDocument(job);

		expect(renderMap).toHaveBeenCalledWith(expect.any(Object), {
			boundary: TURF_2_BOUNDS,
			points: []
		});
	});

	it('leaves locations without coordinates off the map but keeps their number', async () => {
		await generateListDocument(job);

		const masterMap = renderMap.mock.calls.find((c) => !c[1].boundary);
		expect(masterMap?.[1].points.map((p: { label: string }) => p.label)).toEqual(['1', '2']);
	});

	// renderMap throws when there is nothing to frame, so it must not be called.
	it('leaves the map out when nothing can be placed on it', async () => {
		mockDatabase({
			entries: [location('No Pin Cafe', '3 Main St', false)],
			turfs: [{ id: 'turf-1', code: 'KX7-42B', bounds: null }],
			turfLocations: [{ turf_id: 'turf-1', ...location('No Pin Cafe', '3 Main St', false) }]
		});

		await generateListDocument(job);

		const data = renderedData();
		expect(openMapRenderer).not.toHaveBeenCalled();
		expect(renderMap).not.toHaveBeenCalled();
		expect(data.map).toBeUndefined();
		expect(data.turfs[0].map).toBeUndefined();
		expect(statusUpdate()?.[0]).toBe('ready');
	});

	it('still renders a list with no locations or turfs', async () => {
		mockDatabase({ entries: [], turfs: [], turfLocations: [] });

		await generateListDocument(job);

		expect(renderedData()).toMatchObject({ locations: [], turfs: [] });
		expect(statusUpdate()?.[0]).toBe('ready');
	});

	it('skips missing address parts and names unnamed locations', async () => {
		mockDatabase({
			entries: [
				{ ...location('Kiosk', '9 Elm St'), city: null, postal_code: null },
				{ ...location('', ''), name: null, address_line_1: null, state_or_region: null }
			],
			turfs: []
		});

		await generateListDocument(job);

		expect(renderedData().locations).toEqual([
			{ number: 1, name: 'Kiosk', address: '9 Elm St, PA' },
			{ number: 2, name: 'Unnamed location', address: 'Springfield, 19064' }
		]);
	});

	// Defense in depth alongside RLS: every read is filtered by the job's org.
	it('scopes every query it makes to the org', async () => {
		await generateListDocument(job);

		const queries = loaderQueries();
		expect(queries).toHaveLength(4);
		for (const [sql, params] of queries) {
			expect(params).toContain(ORG);
			expect(String(sql)).toMatch(/org_id = \$2/);
		}
	});

	// A document with 30 turfs must not launch Chrome 30 times.
	it('draws every map with one renderer and closes it', async () => {
		await generateListDocument(job);

		expect(openMapRenderer).toHaveBeenCalledOnce();
		expect(renderMap).toHaveBeenCalledTimes(3);
		expect(closeRenderer).toHaveBeenCalledOnce();
	});

	it('closes the renderer and fails the document when a map fails', async () => {
		renderMap.mockRejectedValueOnce(new Error('map never went idle'));

		await generateListDocument(job);

		expect(closeRenderer).toHaveBeenCalled();
		expect(generatePDF).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual(['failed', GENERIC_FAILURE, 'doc-1', ORG]);
	});

	it("prints times in the requester's timezone", async () => {
		mockDatabase({ list: { ...DEFAULT_LIST, expires_at: new Date('2026-10-09T03:00:00Z') } });

		await generateListDocument({ ...job, timeZone: 'America/Los_Angeles' });

		expect(renderedData().expires).toEqual({
			date: 'Oct 8, 2026',
			time: expect.stringMatching(/^8:00\sPM$/),
			timezone: 'PDT'
		});
	});

	it('uses the given zone even when it moves the date', async () => {
		mockDatabase({ list: { ...DEFAULT_LIST, expires_at: new Date('2026-10-09T03:00:00Z') } });

		await generateListDocument({ ...job, timeZone: 'UTC' });

		expect(renderedData().expires).toMatchObject({ date: 'Oct 9, 2026', timezone: 'UTC' });
	});

	it('fails a document that runs past the deadline and stops rendering it', async () => {
		vi.useFakeTimers();
		generatePDF.mockReturnValue(new Promise(() => {}));

		const done = generateListDocument(job);
		await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS);
		await done;

		const signal = generatePDF.mock.calls[0][2].signal as AbortSignal;
		expect(signal.aborted).toBe(true);
		expect(uploadObject).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual([
			'failed',
			'The PDF took too long to generate. Try again shortly.',
			'doc-1',
			ORG
		]);
	});

	it('fails well within the two minutes the page waits', () => {
		expect(GENERATION_TIMEOUT_MS).toBeLessThan(120_000);
	});

	// A failed regeneration must not leave the list without a PDF.
	it('brings back the documents it replaced when it fails', async () => {
		generatePDF.mockRejectedValue(new Error('render failed'));

		await generateListDocument(job);

		expect(restoreQuery()).toEqual(['doc-1', ORG]);
	});

	it('restores nothing when a newer document replaced it meanwhile', async () => {
		mockDatabase({ replacedAt: new Date() });
		generatePDF.mockRejectedValue(new Error('render failed'));

		await generateListDocument(job);

		expect(statusUpdate()?.[0]).toBe('failed');
		expect(restoreQuery()).toBeUndefined();
	});

	it('restores nothing when it succeeds', async () => {
		await generateListDocument(job);

		expect(restoreQuery()).toBeUndefined();
	});

	it('marks the document failed for a people list', async () => {
		mockDatabase({ list: { name: 'Voters', entity_type: 'people', expires_at: new Date() } });

		await generateListDocument(job);

		expect(generatePDF).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual([
			'failed',
			'PDFs can only be generated for location lists.',
			'doc-1',
			ORG
		]);
	});

	it('marks the document failed when the list no longer exists', async () => {
		mockDatabase({ list: null });

		await generateListDocument(job);

		expect(statusUpdate()).toEqual(['failed', 'This list no longer exists.', 'doc-1', ORG]);
	});

	// Internal errors (Chrome, storage, database) must not reach the UI.
	it('records a generic message, not the internal error, when rendering throws', async () => {
		generatePDF.mockRejectedValue(new Error('Protocol error: Target closed at /usr/lib/chromium'));

		await generateListDocument(job);

		expect(uploadObject).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual(['failed', GENERIC_FAILURE, 'doc-1', ORG]);
	});

	it('records a generic message when the upload throws', async () => {
		uploadObject.mockRejectedValue(new Error('AccessDenied: bucket turfbuilder-prod'));

		await generateListDocument(job);

		expect(statusUpdate()).toEqual(['failed', GENERIC_FAILURE, 'doc-1', ORG]);
	});

	it('says storage needs setting up when it is not configured', async () => {
		uploadObject.mockRejectedValue(new StorageNotConfiguredError('internal detail'));

		await generateListDocument(job);

		expect(statusUpdate()).toEqual([
			'failed',
			'PDF storage has not been set up yet. Ask an administrator to configure it.',
			'doc-1',
			ORG
		]);
	});

	it('still logs the real error for operators', async () => {
		const internal = new Error('connection terminated unexpectedly');
		generatePDF.mockRejectedValue(internal);

		await generateListDocument(job);

		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('doc-1'), internal);
	});

	// It runs after the response is sent, so a throw would be an unhandled rejection.
	it('does not throw when the failure cannot be recorded either', async () => {
		generatePDF.mockRejectedValue(new Error('render failed'));
		mockClient.query.mockRejectedValue(new Error('database down'));

		await expect(generateListDocument(job)).resolves.toBeUndefined();
	});
});
