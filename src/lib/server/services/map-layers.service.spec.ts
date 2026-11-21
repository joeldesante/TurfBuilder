import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

import {
	listMapLayers,
	listMapLayersWithShapes,
	getMapLayer,
	createMapLayer,
	updateMapLayer,
	deleteMapLayer,
	reorderMapLayers
} from './map-layers.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LAYER = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const A = 'aaaaaaaa-e5f6-7890-abcd-ef1234567890';
const B = 'bbbbbbbb-e5f6-7890-abcd-ef1234567890';
const row = { id: LAYER, name: 'Wards', color: '#2f6fed', label_field: null, position: 0 };
const geojson = { type: 'FeatureCollection' as const, features: [] };

/** Answers membership and the layer-in-org lookup, and everything else with `rest`. */
function stub(
	rest: (sql: string, values?: unknown[]) => unknown = () => ({ rowCount: 1, rows: [row] }),
	layerFound = true
) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve({ rowCount: 1, rows: [{ organization_id: ORG, role: 'member' }] });
		}
		if (sql.includes('SELECT 1 FROM public.map_layer')) {
			return Promise.resolve(layerFound ? { rowCount: 1, rows: [{}] } : { rowCount: 0, rows: [] });
		}
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listMapLayers', () => {
	it("selects the org's layers, top first", async () => {
		expect(await listMapLayers('u1', ORG)).toEqual([row]);

		const [sql, values] = sqlRun('FROM public.map_layer')!;
		expect(sql).toContain('ORDER BY position');
		expect(values).toEqual([ORG]);
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listMapLayers('u1', ORG)).rejects.toMatchObject({ status: 403 });
	});
});

describe('the shapes', () => {
	it('are left out of the list, which only names and orders the layers', async () => {
		await listMapLayers('u1', ORG);

		expect(String(sqlRun('FROM public.map_layer')![0])).not.toContain('geojson');
	});

	it('are in the list the map editor loads', async () => {
		await listMapLayersWithShapes('u1', ORG);

		const [sql, values] = sqlRun('FROM public.map_layer')!;
		expect(String(sql)).toContain('geojson');
		expect(String(sql)).toContain('ORDER BY position');
		expect(values).toEqual([ORG]);
	});

	it('come with a single layer, read as its org', async () => {
		expect(await getMapLayer('u1', LAYER)).toEqual(row);

		const [sql, values] = sqlRun('SELECT id, name, color, label_field, position, created_at, updated_at, geojson')!;
		expect(String(sql)).toContain('WHERE id = $1 AND organization_id = $2');
		expect(values).toEqual([LAYER, ORG]);
	});

	it('answer 404 for a layer in none of the caller orgs', async () => {
		stub(undefined, false);

		await expect(getMapLayer('u1', LAYER)).rejects.toMatchObject({ status: 404 });
	});

	it('are not sent back after an add or a change', async () => {
		await createMapLayer('u1', ORG, { name: 'Wards', color: '#2f6fed', label_field: null, geojson });
		await updateMapLayer('u1', LAYER, { color: '#e63946' });

		const returning = mockClient.query.mock.calls
			.map((c) => String(c[0]))
			.filter((sql) => sql.includes('RETURNING'));
		expect(returning).toHaveLength(2);
		for (const sql of returning) expect(sql.split('RETURNING')[1]).not.toContain('geojson');
	});
});

describe('createMapLayer', () => {
	it('moves the others down one, then puts the new layer on top', async () => {
		await createMapLayer('u1', ORG, { name: 'Wards', color: '#2f6fed', label_field: 'NAME', geojson });

		const order = mockClient.query.mock.calls.map((c) => String(c[0]));
		const shift = order.findIndex((s) => s.includes('SET position = position + 1'));
		const insert = order.findIndex((s) => s.includes('INSERT INTO public.map_layer'));
		expect(shift).toBeGreaterThan(-1);
		expect(shift).toBeLessThan(insert);
		expect(sqlRun('SET position = position + 1')![1]).toEqual([ORG]);
		expect(sqlRun('INSERT INTO public.map_layer')![1]).toEqual([
			ORG,
			'Wards',
			'#2f6fed',
			'NAME',
			JSON.stringify(geojson)
		]);
	});

	it('answers 403 without staff access and writes nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(
			createMapLayer('u1', ORG, { name: 'Wards', color: '#2f6fed', label_field: null, geojson })
		).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('INSERT INTO public.map_layer')).toBeUndefined();
	});
});

describe('updateMapLayer', () => {
	it('keeps the label when the input leaves it out', async () => {
		await updateMapLayer('u1', LAYER, { color: '#e63946' });

		expect(sqlRun('UPDATE public.map_layer')![1]).toEqual([LAYER, ORG, null, '#e63946', false, null]);
	});

	it('clears the label when the input sets it to null', async () => {
		await updateMapLayer('u1', LAYER, { label_field: null });

		expect(sqlRun('UPDATE public.map_layer')![1]).toEqual([LAYER, ORG, null, null, true, null]);
	});

	it('answers 404 for a layer in none of the caller orgs', async () => {
		stub(undefined, false);

		await expect(updateMapLayer('u1', LAYER, { name: 'x' })).rejects.toMatchObject({ status: 404 });
	});
});

describe('deleteMapLayer', () => {
	it('deletes the layer as its org', async () => {
		await deleteMapLayer('u1', LAYER);

		expect(sqlRun('DELETE FROM public.map_layer')![1]).toEqual([LAYER, ORG]);
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(deleteMapLayer('u1', LAYER)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('DELETE FROM public.map_layer')).toBeUndefined();
	});
});

describe('reorderMapLayers', () => {
	function stubLayers(ids: string[]) {
		stub((sql) =>
			sql.includes('FOR UPDATE') ? { rows: ids.map((id) => ({ id })) } : { rowCount: 2, rows: [] }
		);
	}

	it('numbers the layers in the given order', async () => {
		stubLayers([A, B]);

		await reorderMapLayers('u1', ORG, [B, A]);

		expect(sqlRun('SET position = ordered.position')![1]).toEqual([ORG, [B, A]]);
	});

	it('answers 409 when the ids do not match the layers', async () => {
		stubLayers([A, B]);

		await expect(reorderMapLayers('u1', ORG, [A])).rejects.toMatchObject({ status: 409 });
		await expect(reorderMapLayers('u1', ORG, [A, A])).rejects.toMatchObject({ status: 409 });
		expect(sqlRun('SET position = ordered.position')).toBeUndefined();
	});
});
