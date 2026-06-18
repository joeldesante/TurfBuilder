import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import EntityDetailPage from './EntityDetailPage.svelte';

const personRecord = {
	id: 'rec-001',
	entity_id: 'ent-abc-123',
	first_name: 'Alice',
	middle_name: null,
	last_name: 'Nguyen',
	suffix: null,
	preferred_name: null,
	dob: '1990-03-15',
	phone: '555-1234',
	email: 'alice@example.com',
	gender: 'Female',
	valid_to: null,
	source: 'org' as const
};

const locationRecord = {
	id: 'rec-loc-001',
	entity_id: 'ent-loc-456',
	name: 'City Hall',
	address_line_1: '100 Main St',
	address_line_2: null,
	address_line_3: null,
	city: 'Springfield',
	state_or_region: 'IL',
	postal_code: '62701',
	country_code: 'US',
	valid_to: null,
	source: 'org' as const
};

test('renders person full name as heading', async () => {
	const { getByRole } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: personRecord,
			isOutdated: false
		}
	});
	await expect.element(getByRole('heading', { name: 'Alice Nguyen' })).toBeVisible();
});

test('renders person fields', async () => {
	const { getByText } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: personRecord,
			isOutdated: false
		}
	});
	await expect.element(getByText('alice@example.com')).toBeVisible();
	await expect.element(getByText('555-1234')).toBeVisible();
});

test('renders location name as heading', async () => {
	const { getByRole } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'location',
			entityId: 'ent-loc-456',
			record: locationRecord,
			isOutdated: false
		}
	});
	await expect.element(getByRole('heading', { name: 'City Hall' })).toBeVisible();
});

test('renders location fields', async () => {
	const { getByText } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'location',
			entityId: 'ent-loc-456',
			record: locationRecord,
			isOutdated: false
		}
	});
	await expect.element(getByText('100 Main St')).toBeVisible();
	await expect.element(getByText('Springfield')).toBeVisible();
});

test('does not show outdated banner for current records', async () => {
	const { container } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: personRecord,
			isOutdated: false
		}
	});
	const banner = container.querySelector('[class*="warning"]');
	expect(banner).toBeNull();
});

test('shows outdated banner when viewing old version', async () => {
	const { getByText } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: { ...personRecord, valid_to: new Date().toISOString() },
			isOutdated: true
		}
	});
	await expect.element(getByText(/older version/i)).toBeVisible();
});

test('outdated banner links to current version', async () => {
	const { getByRole } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: { ...personRecord, valid_to: new Date().toISOString() },
			isOutdated: true
		}
	});
	const link = getByRole('link', { name: /View the latest version/i });
	await expect.element(link).toBeVisible();
	await expect.element(link).toHaveAttribute('href', '/o/test-org/s/universe/entity/ent-abc-123');
});

test('renders back link when backHref provided', async () => {
	const { getByRole } = render(EntityDetailPage, {
		props: {
			orgSlug: 'test-org',
			entityType: 'person',
			entityId: 'ent-abc-123',
			record: personRecord,
			isOutdated: false,
			backHref: '/o/test-org/s/universe/buckets/voters/lists/list-1'
		}
	});
	await expect.element(getByRole('link', { name: /Back to List/i })).toBeVisible();
});
