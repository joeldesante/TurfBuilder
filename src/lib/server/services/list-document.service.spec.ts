import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, generatePDF, uploadObject, renderMap } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	generatePDF: vi.fn(),
	uploadObject: vi.fn(),
	renderMap: vi.fn()
}));

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
vi.mock('./map-engine.service', () => ({ renderMap }));
vi.mock('$lib/server/storage', () => ({ uploadObject }));

import { generateListDocument } from './list-document.service';

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

function location(name: string, address: string, coords = true) {
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

/** Answers the loader's queries by table; everything else (BEGIN, UPDATE, ...) succeeds. */
function mockDatabase(
	list: { name: string; entity_type: string; expires_at: Date } | null = {
		name: 'Downtown',
		entity_type: 'locations',
		expires_at: new Date('2026-10-08T23:59:00Z')
	}
) {
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM universe.list\n')) return { rows: list ? [list] : [] };
		if (sql.includes('FROM universe.list_entry'))
			return {
				rows: [
					location('Quick Mart', '1 Main St'),
					location('Hardware', '2 Main St'),
					location('No Pin Cafe', '3 Main St', false)
				]
			};
		if (sql.includes('FROM universe.turf\n'))
			return { rows: [{ id: 'turf-1', code: 'KX7-42B', bounds: JSON.stringify(TURF_BOUNDS) }] };
		if (sql.includes('FROM universe.turf_location'))
			return {
				rows: [
					{ turf_id: 'turf-1', ...location('Hardware', '2 Main St') },
					{ turf_id: 'turf-1', ...location('Quick Mart', '1 Main St') }
				]
			};
		return { rows: [], rowCount: 1 };
	});
}

function renderedData() {
	return generatePDF.mock.calls[0][1];
}

function statusUpdate() {
	const call = mockClient.query.mock.calls.find((c) =>
		String(c[0]).includes('UPDATE universe.list_document')
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

describe('generateListDocument', () => {
	it('uploads the pdf to the reserved key and marks it ready', async () => {
		await generateListDocument(job);

		expect(generatePDF).toHaveBeenCalledWith(expect.stringContaining('{{list.name}}'), expect.any(Object));
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
			date: expect.any(String),
			time: expect.any(String),
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

	it('leaves locations without coordinates off the map but keeps their number', async () => {
		await generateListDocument(job);

		const masterMap = renderMap.mock.calls.find((c) => !c[1].boundary);
		expect(masterMap?.[1].points.map((p: { label: string }) => p.label)).toEqual(['1', '2']);
	});

	it('marks the document failed for a people list', async () => {
		mockDatabase({ name: 'Voters', entity_type: 'people', expires_at: new Date() });

		await generateListDocument(job);

		expect(generatePDF).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual([
			'failed',
			'Documents can only be generated for location lists',
			'doc-1',
			ORG
		]);
	});

	it('marks the document failed when the list no longer exists', async () => {
		mockDatabase(null);

		await generateListDocument(job);

		expect(statusUpdate()).toEqual(['failed', 'List not found', 'doc-1', ORG]);
	});

	it('marks the document failed with the reason when rendering throws', async () => {
		generatePDF.mockRejectedValue(new Error('Chrome is missing'));

		await generateListDocument(job);

		expect(uploadObject).not.toHaveBeenCalled();
		expect(statusUpdate()).toEqual(['failed', 'Chrome is missing', 'doc-1', ORG]);
	});

	it('marks the document failed when the upload throws', async () => {
		uploadObject.mockRejectedValue(new Error('Object storage is not configured.'));

		await generateListDocument(job);

		expect(statusUpdate()).toEqual(['failed', 'Object storage is not configured.', 'doc-1', ORG]);
	});

	// It runs after the response is sent, so a throw would be an unhandled rejection.
	it('does not throw when the failure cannot be recorded either', async () => {
		generatePDF.mockRejectedValue(new Error('render failed'));
		mockClient.query.mockRejectedValue(new Error('database down'));

		await expect(generateListDocument(job)).resolves.toBeUndefined();
	});
});
