import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import UniverseDataContactsPage from './UniverseDataContactsPage.svelte';
import { dragBy } from '$components/__tests__/drag';

const NAME = '11111111-1111-4111-8111-111111111111';
const OPEN = '22222222-2222-4222-8222-222222222222';
const STAFF = '33333333-3333-4333-8333-333333333333';
const CAPACITY = '44444444-4444-4444-8444-444444444444';

const business = {
	id: 's1',
	org_id: 'o1',
	schema_name: 'Business',
	fields: [
		{ id: NAME, name: 'name', type: 'text', required: true },
		{ id: OPEN, name: 'open', type: 'boolean', required: false },
		{ id: STAFF, name: 'staff', type: 'number', required: false }
	],
	identifier_field_id: NAME,
	contact_count: 2,
	created_at: '',
	updated_at: ''
};
const venue = {
	...business,
	id: 's2',
	schema_name: 'Venue',
	fields: [{ id: CAPACITY, name: 'capacity', type: 'number', required: false }],
	identifier_field_id: null
};

const props = {
	orgSlug: 'acme',
	schemas: [business, venue] as never,
	selected: business as never,
	contacts: [
		{
			id: 'c1',
			identifier: 'Corner Deli',
			metadata: { [NAME]: 'Corner Deli', [OPEN]: true, [STAFF]: 4 }
		},
		{
			id: 'c2',
			identifier: '2 Elm St, Philadelphia',
			metadata: { [NAME]: 'Night Owl', [OPEN]: false }
		}
	],
	totalCount: 2
};

describe('UniverseDataContactsPage', () => {
	it('starts with an All tab, then one tab per schema, with the selected one marked', async () => {
		render(UniverseDataContactsPage, props);

		await expect
			.element(page.getByRole('link', { name: 'All' }))
			.not.toHaveAttribute('aria-current');

		const businessTab = page.getByRole('link', { name: 'Business' });
		await expect.element(businessTab).toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Venue' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts?schema=s2');
	});

	it('does not offer People or Locations tabs', async () => {
		render(UniverseDataContactsPage, props);

		await expect.element(page.getByRole('link', { name: 'People' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Locations' })).not.toBeInTheDocument();
	});

	it("shows a column for each of the schema's fields and each contact's values", async () => {
		render(UniverseDataContactsPage, props);

		await expect.element(page.getByText('staff', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Corner Deli').first()).toBeVisible();
		await expect.element(page.getByText('Yes')).toBeVisible();
		await expect.element(page.getByText('No', { exact: true })).toBeVisible();
	});

	it('keeps the schema in the page links', async () => {
		render(UniverseDataContactsPage, { ...props, totalCount: 250 });

		await expect
			.element(page.getByRole('link', { name: '2' }).first())
			.toHaveAttribute('href', '?schema=s1&page=2');
	});

	it('says so when no contact uses the schema', async () => {
		render(UniverseDataContactsPage, { ...props, contacts: [], totalCount: 0 });

		await expect.element(page.getByText('No contacts use this schema yet.')).toBeVisible();
	});

	it('lists every contact with its schema on the All tab', async () => {
		render(UniverseDataContactsPage, {
			...props,
			selected: null,
			contacts: [
				{
					id: 'c1',
					identifier: 'Corner Deli',
					metadata: { [NAME]: 'Corner Deli', [OPEN]: true },
					schema_id: 's1',
					schema_name: 'Business'
				},
				{
					id: 'c2',
					identifier: '9 Hill Rd',
					metadata: { name: 'Old Barn' },
					schema_id: null,
					schema_name: null
				}
			]
		});

		await expect
			.element(page.getByRole('link', { name: 'All' }))
			.toHaveAttribute('aria-current', 'page');
		await expect.element(page.getByText('name: Corner Deli, open: Yes')).toBeVisible();
		await expect.element(page.getByText('None')).toBeVisible();
	});

	it('moves a dragged tab and reports the new order', async () => {
		const onReorder = vi.fn().mockResolvedValue(undefined);
		render(UniverseDataContactsPage, { ...props, onReorder });

		const business = page.getByRole('link', { name: 'Business' }).element() as HTMLElement;
		const release = await dragBy(business.closest('li')!, 120);
		release();

		await vi.waitFor(() => expect(onReorder).toHaveBeenCalledWith(['s2', 's1']));
	});

	it('does not follow the tab link for the click that ends a drag', async () => {
		render(UniverseDataContactsPage, { ...props, onReorder: vi.fn().mockResolvedValue(undefined) });

		const business = page.getByRole('link', { name: 'Business' }).element() as HTMLElement;
		const release = await dragBy(business.closest('li')!, 120);
		release();
		// A real release is followed at once by a click on the same element.
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		business.dispatchEvent(click);

		expect(click.defaultPrevented).toBe(true);
	});

	it('points to the schema page when the org has no schemas', async () => {
		render(UniverseDataContactsPage, {
			orgSlug: 'acme',
			schemas: [],
			selected: null,
			contacts: [],
			totalCount: 0
		});

		await expect
			.element(page.getByRole('link', { name: 'Create a contact schema' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contact-schemas');
	});

	it('has a List and Map pill group, with the shown view marked', async () => {
		render(UniverseDataContactsPage, props);

		await expect
			.element(page.getByRole('link', { name: 'List' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Map' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts?schema=s1&view=map');
	});

	it('keeps the schema and view when switching tabs and views', async () => {
		render(UniverseDataContactsPage, { ...props, view: 'map', markers: [] });

		await expect
			.element(page.getByRole('link', { name: 'Map' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'List' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts?schema=s1');
		await expect
			.element(page.getByRole('link', { name: 'Venue' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts?schema=s2&view=map');
		await expect
			.element(page.getByRole('link', { name: 'All' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts?view=map');
	});

	it('says so when no contact on the map view has a position', async () => {
		render(UniverseDataContactsPage, { ...props, view: 'map', markers: [] });

		await expect
			.element(page.getByText('No contacts here have a position to show on the map.'))
			.toBeVisible();
		await expect.element(page.getByRole('table')).not.toBeInTheDocument();
	});

	it('has an Import Contacts button beside the view tabs', async () => {
		render(UniverseDataContactsPage, props);

		await expect.element(page.getByRole('button', { name: 'Import Contacts' })).toBeVisible();
	});

	it("shows each contact's identifier, from its schema field or its address", async () => {
		render(UniverseDataContactsPage, props);

		await expect.element(page.getByText('Identifier', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: '2 Elm St, Philadelphia' })).toBeVisible();
	});
});

describe('UniverseDataContactsPage search and filters', () => {
	const austin = {
		operator: 'AND' as const,
		filters: [{ item: 'city', operation: 'equals' as const, value: 'Austin' }]
	};

	it('shows a search box and a Filters button only when it can apply them', async () => {
		render(UniverseDataContactsPage, props);

		await expect
			.element(page.getByRole('searchbox', { name: 'Search contacts' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
	});

	it('puts the search and Filters just under the Contacts heading, above the tabs', async () => {
		render(UniverseDataContactsPage, { ...props, onFilter: vi.fn() });

		const search = page.getByRole('searchbox', { name: 'Search contacts' }).element();
		const tabs = page.getByRole('navigation', { name: 'Contact schemas' }).element();
		expect(search.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('applies the search text, trimmed, when it is submitted', async () => {
		const onFilter = vi.fn();
		render(UniverseDataContactsPage, { ...props, onFilter, filters: austin });

		await page.getByRole('searchbox', { name: 'Search contacts' }).fill('  deli  ');
		await page.getByRole('searchbox', { name: 'Search contacts' }).click();
		await userEvent.keyboard('{Enter}');

		expect(onFilter).toHaveBeenCalledWith({ search: 'deli', filters: austin });
	});

	it('starts with the current search in the box', async () => {
		render(UniverseDataContactsPage, { ...props, onFilter: vi.fn(), search: 'barn' });

		await expect
			.element(page.getByRole('searchbox', { name: 'Search contacts' }))
			.toHaveValue('barn');
	});

	it('opens the same filter editor the buckets use, and applies what is built in it', async () => {
		const onFilter = vi.fn();
		render(UniverseDataContactsPage, { ...props, onFilter });

		await page.getByRole('button', { name: 'Filters' }).click();
		await expect.element(page.getByRole('region', { name: 'Contact filters' })).toBeVisible();
		await page.getByRole('button', { name: 'Add Filter' }).click();
		await page.getByRole('button', { name: /^City/ }).click();
		await page.getByRole('textbox', { name: 'Value' }).fill('Austin');
		await page.getByRole('button', { name: 'Add filter', exact: true }).click();
		await page.getByRole('button', { name: 'Apply Filters' }).click();

		expect(onFilter).toHaveBeenCalledWith({ search: '', filters: austin });
		await expect
			.element(page.getByRole('region', { name: 'Contact filters' }))
			.not.toBeInTheDocument();
	});

	it('shows how many filters are applied, and the editor starts with them', async () => {
		render(UniverseDataContactsPage, { ...props, onFilter: vi.fn(), filters: austin });

		await expect.element(page.getByLabelText('1 applied')).toBeVisible();

		await page.getByRole('button', { name: /Filters/ }).click();
		await expect.element(page.getByText(/city is Austin/)).toBeVisible();
	});

	it('clears the filters but keeps the search', async () => {
		const onFilter = vi.fn();
		render(UniverseDataContactsPage, { ...props, onFilter, filters: austin, search: 'deli' });

		await page.getByRole('button', { name: /Filters/ }).click();
		await page.getByRole('button', { name: 'Clear Filters' }).click();

		expect(onFilter).toHaveBeenCalledWith({ search: 'deli', filters: null });
	});

	it('keeps the search and filters in the tab, view, and page links', async () => {
		render(UniverseDataContactsPage, {
			...props,
			onFilter: vi.fn(),
			search: 'deli',
			filters: austin,
			totalCount: 250
		});

		const kept = `q=deli&filters=${encodeURIComponent(JSON.stringify(austin))}`;
		await expect
			.element(page.getByRole('link', { name: 'Venue' }))
			.toHaveAttribute('href', `/o/acme/s/universe/data/contacts?schema=s2&${kept}`);
		await expect
			.element(page.getByRole('link', { name: 'Map' }))
			.toHaveAttribute('href', `/o/acme/s/universe/data/contacts?schema=s1&view=map&${kept}`);
		await expect
			.element(page.getByRole('link', { name: '2' }).first())
			.toHaveAttribute('href', `?schema=s1&${kept}&page=2`);
	});
});
