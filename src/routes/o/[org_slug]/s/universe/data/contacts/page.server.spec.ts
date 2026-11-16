import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listContactSchemas, listSchemaContacts, listAllContacts, listContactMarkers } = vi.hoisted(
	() => ({
		listContactSchemas: vi.fn(),
		listSchemaContacts: vi.fn(),
		listAllContacts: vi.fn(),
		listContactMarkers: vi.fn()
	})
);

vi.mock('$lib/server/services/contact-schemas.service', () => ({
	listContactSchemas,
	listSchemaContacts,
	listAllContacts,
	listContactMarkers,
	MAX_SEARCH_LENGTH: 200
}));

import { load } from './+page.server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const locals = { user: { id: 'u1' }, organization: { id: ORG } };
const business = { id: 's1', schema_name: 'Business' };
const venue = { id: 's2', schema_name: 'Venue' };
const none = { search: '', filters: null };
const austin = {
	operator: 'AND',
	filters: [{ item: 'city', operation: 'equals', value: 'Austin' }]
};

function event(query = '', loc: unknown = locals) {
	return {
		locals: loc,
		url: new URL(`https://x/o/acme/s/universe/data/contacts${query}`)
	} as never;
}

beforeEach(() => {
	vi.clearAllMocks();
	listContactSchemas.mockResolvedValue([business, venue]);
	listSchemaContacts.mockResolvedValue({
		items: [{ id: 'c1' }],
		totalCount: 1,
		page: 1,
		pageSize: 100
	});
	listAllContacts.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 });
	listContactMarkers.mockResolvedValue([]);
});

describe('data/contacts load', () => {
	it('shows the All tab when no schema is asked for', async () => {
		listAllContacts.mockResolvedValue({
			items: [{ id: 'a1' }],
			totalCount: 9,
			page: 1,
			pageSize: 100
		});

		const data = await load(event());

		expect(data.selected).toBeNull();
		expect(data.contacts).toEqual([{ id: 'a1' }]);
		expect(listAllContacts).toHaveBeenCalledWith('u1', ORG, 0, none);
		expect(listSchemaContacts).not.toHaveBeenCalled();
	});

	it('shows the schema named by ?schema and the requested page', async () => {
		const data = await load(event('?schema=s2&page=3'));

		expect(data.selected).toBe(venue);
		expect(listSchemaContacts).toHaveBeenCalledWith('u1', 's2', 3, none);
		expect(listAllContacts).not.toHaveBeenCalled();
	});

	it('falls back to All for an unknown id', async () => {
		const data = await load(event('?schema=nope'));

		expect(data.selected).toBeNull();
	});

	it('answers 401 when signed out', async () => {
		await expect(load(event('', {}))).rejects.toMatchObject({ status: 401 });
	});

	it('is a list unless ?view=map is given', async () => {
		expect((await load(event())).view).toBe('list');
		expect((await load(event('?view=other'))).view).toBe('list');
	});

	it('loads only the pins for the map view of the All tab', async () => {
		listContactMarkers.mockResolvedValue([{ id: 'm1' }]);

		const data = await load(event('?view=map'));

		expect(data).toMatchObject({
			view: 'map',
			selected: null,
			markers: [{ id: 'm1' }],
			contacts: []
		});
		expect(listContactMarkers).toHaveBeenCalledWith('u1', ORG, null, none);
		expect(listAllContacts).not.toHaveBeenCalled();
		expect(listSchemaContacts).not.toHaveBeenCalled();
	});

	it("loads the pins of the selected schema for that tab's map view", async () => {
		await load(event('?schema=s2&view=map'));

		expect(listContactMarkers).toHaveBeenCalledWith('u1', ORG, 's2', none);
	});
});

describe('data/contacts load, search and filters', () => {
	const filtersParam = encodeURIComponent(JSON.stringify(austin));

	it('passes the search text, trimmed, to the list and the map', async () => {
		await load(event('?q=%20deli%20'));
		await load(event('?q=deli&view=map'));

		expect(listAllContacts).toHaveBeenCalledWith('u1', ORG, 0, { search: 'deli', filters: null });
		expect(listContactMarkers).toHaveBeenCalledWith('u1', ORG, null, {
			search: 'deli',
			filters: null
		});
	});

	it('cuts search text that is too long instead of refusing it', async () => {
		await load(event(`?q=${'a'.repeat(500)}`));

		expect(listAllContacts.mock.calls[0][3].search).toHaveLength(200);
	});

	it('passes valid filters from ?filters= to the list, the schema list, and the map', async () => {
		await load(event(`?filters=${filtersParam}`));
		await load(event(`?schema=s2&filters=${filtersParam}`));
		await load(event(`?view=map&filters=${filtersParam}`));

		expect(listAllContacts).toHaveBeenCalledWith('u1', ORG, 0, { search: '', filters: austin });
		expect(listSchemaContacts).toHaveBeenCalledWith('u1', 's2', 0, { search: '', filters: austin });
		expect(listContactMarkers).toHaveBeenCalledWith('u1', ORG, null, {
			search: '',
			filters: austin
		});
	});

	it('returns the search and filters so the page can show them', async () => {
		const data = await load(event(`?q=deli&filters=${filtersParam}`));

		expect(data).toMatchObject({ search: 'deli', filters: austin });
	});

	it('ignores filters that are not JSON, not a valid filter, or empty', async () => {
		const bad = await load(event('?filters=%7Bnot-json'));
		const invalid = await load(event(`?filters=${encodeURIComponent('{"operator":"XOR"}')}`));
		const empty = await load(
			event(`?filters=${encodeURIComponent(JSON.stringify({ operator: 'AND', filters: [] }))}`)
		);

		expect(bad.filters).toBeNull();
		expect(invalid.filters).toBeNull();
		expect(empty.filters).toBeNull();
	});
});
