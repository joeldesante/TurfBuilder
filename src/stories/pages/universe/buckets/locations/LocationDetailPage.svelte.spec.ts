import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import LocationDetailPage from './LocationDetailPage.svelte';

const namedLocation = {
	id: '1',
	name: 'City Hall',
	address_line_1: '100 Main St',
	address_line_2: null,
	address_line_3: null,
	city: 'Springfield',
	state_or_region: 'IL',
	postal_code: '62701',
	country_code: 'US',
	source: 'public' as const
};

const unnamedLocation = {
	id: '2',
	name: null,
	address_line_1: '42 Oak Ave',
	address_line_2: 'Apt 3',
	address_line_3: null,
	city: 'Springfield',
	state_or_region: 'IL',
	postal_code: '62702',
	country_code: 'US',
	source: 'org' as const
};

test('renders location name as heading when present', async () => {
	const { getByRole } = render(LocationDetailPage, {
		props: { location: namedLocation, backHref: '/locations' }
	});
	await expect.element(getByRole('heading', { name: 'City Hall' })).toBeVisible();
});

test('falls back to address as heading when no name', async () => {
	const { getByRole } = render(LocationDetailPage, {
		props: { location: unnamedLocation, backHref: '/locations' }
	});
	await expect.element(getByRole('heading', { name: /42 Oak Ave/ })).toBeVisible();
});

test('renders address fields', async () => {
	const { getByText } = render(LocationDetailPage, {
		props: { location: namedLocation, backHref: '/locations' }
	});
	await expect.element(getByText('100 Main St')).toBeVisible();
	await expect.element(getByText('Springfield')).toBeVisible();
	await expect.element(getByText('62701')).toBeVisible();
});

test('omits fields with no value', async () => {
	const { container } = render(LocationDetailPage, {
		props: { location: namedLocation, backHref: '/locations' }
	});
	expect(container.textContent).not.toContain('Address Line 2');
});

test('renders back link with correct href', async () => {
	const { getByRole } = render(LocationDetailPage, {
		props: { location: namedLocation, backHref: '/buckets/my-bucket/locations' }
	});
	await expect.element(getByRole('link', { name: /back to locations/i })).toHaveAttribute('href', '/buckets/my-bucket/locations');
});
