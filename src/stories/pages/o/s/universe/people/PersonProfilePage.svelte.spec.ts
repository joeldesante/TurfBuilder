import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import PersonProfilePage from './PersonProfilePage.svelte';

const fullPerson = {
	id: '1',
	first_name: 'Alice',
	middle_name: 'Marie',
	last_name: 'Johnson',
	suffix: null,
	preferred_name: 'Ali',
	dob: new Date('1985-04-12'),
	phone: '555-0101',
	email: 'alice@example.com',
	gender: 'Female',
	source: 'public' as const
};

const minimalPerson = {
	id: '2',
	first_name: 'Bob',
	middle_name: null,
	last_name: 'Smith',
	suffix: null,
	preferred_name: null,
	dob: null,
	phone: null,
	email: null,
	gender: null,
	source: 'org' as const
};

test('renders full name as heading', async () => {
	const { getByRole } = render(PersonProfilePage, {
		props: { person: fullPerson, backHref: '/people' }
	});
	await expect.element(getByRole('heading', { name: 'Alice Marie Johnson' })).toBeVisible();
});

test('shows preferred name when present', async () => {
	const { getByText } = render(PersonProfilePage, {
		props: { person: fullPerson, backHref: '/people' }
	});
	await expect.element(getByText(/Goes by "Ali"/)).toBeVisible();
});

test('renders email and phone fields', async () => {
	const { getByText } = render(PersonProfilePage, {
		props: { person: fullPerson, backHref: '/people' }
	});
	await expect.element(getByText('alice@example.com')).toBeVisible();
	await expect.element(getByText('555-0101')).toBeVisible();
});

test('omits fields with no value', async () => {
	const { container } = render(PersonProfilePage, {
		props: { person: minimalPerson, backHref: '/people' }
	});
	expect(container.textContent).not.toContain('Email');
	expect(container.textContent).not.toContain('Phone');
});

test('renders back link with correct href', async () => {
	const { getByRole } = render(PersonProfilePage, {
		props: { person: fullPerson, backHref: '/buckets/my-bucket/people' }
	});
	await expect.element(getByRole('link', { name: /back to people/i })).toHaveAttribute('href', '/buckets/my-bucket/people');
});
