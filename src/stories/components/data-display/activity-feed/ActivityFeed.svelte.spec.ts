import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import ActivityFeed from './ActivityFeed.svelte';
import type { ActivityEntry } from '$lib/shared/types/activity';

const visit: ActivityEntry = {
	id: '1',
	type: 'canvass.visit',
	label: 'Visited a location',
	userId: 'u1',
	userName: 'Grace Hopper',
	orgId: 'o1',
	orgName: 'Riverside',
	metadata: { contact_made: false },
	occurredAt: '2026-10-18T15:00:00.000Z'
};

test('names the person and the org, with links when given', async () => {
	const { getByRole, getByText } = render(ActivityFeed, {
		props: { items: [visit], userHref: (id: string) => `/u/${id}`, orgHref: (id: string) => `/o/${id}` }
	});

	await expect.element(getByRole('link', { name: 'Grace Hopper' })).toHaveAttribute('href', '/u/u1');
	await expect.element(getByRole('link', { name: 'Riverside' })).toHaveAttribute('href', '/o/o1');
	await expect.element(getByText(/No answer/)).toBeVisible();
});

test('leaves the person out on their own page', async () => {
	const { getByText } = render(ActivityFeed, { props: { items: [visit], showUser: false } });

	await expect.element(getByText('Grace Hopper')).not.toBeInTheDocument();
	await expect.element(getByText(/Visited a location/)).toBeVisible();
});

test('says so when there is nothing', async () => {
	const { getByText } = render(ActivityFeed, { props: { items: [], emptyText: 'No activity.' } });

	await expect.element(getByText('No activity.')).toBeVisible();
});
