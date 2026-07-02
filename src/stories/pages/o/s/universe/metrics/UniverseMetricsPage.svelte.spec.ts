import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

const { mapHandlers, markerInstances } = vi.hoisted(() => ({
	mapHandlers: {} as Record<string, ((event?: unknown) => void)[]>,
	markerInstances: [] as { element: HTMLElement }[]
}));

vi.mock('maplibre-gl', () => {
	// Constructor mocks use function expressions because arrow functions cannot
	// be called with `new`.
	const Map = vi.fn(function () {
		return {
			on: vi.fn((event: string, handler: () => void) => {
				(mapHandlers[event] ??= []).push(handler);
			}),
			once: vi.fn(),
			remove: vi.fn(),
			setStyle: vi.fn(),
			fitBounds: vi.fn(),
			flyTo: vi.fn()
		};
	});
	const Marker = vi.fn(function (options: { element: HTMLElement }) {
		markerInstances.push({ element: options.element });
		const instance = {
			setLngLat: () => instance,
			setPopup: () => instance,
			addTo: () => instance,
			remove: vi.fn(),
			getPopup: () => ({ isOpen: () => false }),
			togglePopup: vi.fn()
		};
		return instance;
	});
	const Popup = vi.fn(function () {
		const instance = { setDOMContent: () => instance };
		return instance;
	});
	const LngLatBounds = vi.fn(function () {
		const instance = { extend: () => instance };
		return instance;
	});
	const namespace = { Map, Marker, Popup, LngLatBounds };
	return { ...namespace, default: namespace };
});

vi.mock('$lib/map-style', () => ({
	getMapStyle: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import UniverseMetricsPage from './UniverseMetricsPage.svelte';

beforeEach(() => {
	for (const key of Object.keys(mapHandlers)) delete mapHandlers[key];
	markerInstances.length = 0;
});

test('renders an initial tab', async () => {
	const { getByText } = render(UniverseMetricsPage, { props: { orgSlug: 'test-org' } });
	await expect.element(getByText('Tab 1', { exact: true })).toBeVisible();
});

test('adds a new tab when the new tab button is clicked', async () => {
	const { getByRole, getByText } = render(UniverseMetricsPage, {
		props: { orgSlug: 'test-org' }
	});
	await getByRole('button', { name: 'New tab' }).click();
	await expect.element(getByText('Tab 2', { exact: true })).toBeVisible();
});

test('marks the clicked tab as selected', async () => {
	const { getByRole } = render(UniverseMetricsPage, {
		props: { orgSlug: 'test-org' }
	});

	await getByRole('button', { name: 'New tab' }).click();
	await expect
		.element(getByRole('tab', { name: /Tab 2/ }))
		.toHaveAttribute('aria-selected', 'true');

	await getByRole('tab', { name: /Tab 1/ }).click();
	await expect
		.element(getByRole('tab', { name: /Tab 1/ }))
		.toHaveAttribute('aria-selected', 'true');
	await expect
		.element(getByRole('tab', { name: /Tab 2/ }))
		.toHaveAttribute('aria-selected', 'false');
});

test('renders the locations map alongside the workflow sidebar', async () => {
	const { getByTestId, getByLabelText } = render(UniverseMetricsPage, {
		props: {
			orgSlug: 'test-org',
			buckets: [{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' }]
		}
	});

	await expect.element(getByTestId('locations-map')).toBeInTheDocument();
	await expect.element(getByLabelText('Bucket')).toBeVisible();
});

function fireMapEvent(event: string) {
	for (const handler of mapHandlers[event] ?? []) handler();
}

test('fetches and displays results after the workflow is submitted', async () => {
	const resultLocation = {
		id: 'public:loc-1',
		name: 'Community Center',
		address_line_1: '100 Main St',
		city: 'Philadelphia',
		latitude: 40.01,
		longitude: -75.1,
		questions: [
			{
				id: 'q1',
				text: 'Will you vote?',
				type: 'single_choice',
				choices: ['Yes', 'No'],
				responses: [{ value: 'Yes', respondedAt: '2026-06-01T12:00:00.000Z', respondedBy: 'alice' }]
			}
		]
	};

	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			if (url.includes('/api/surveys')) {
				return { ok: true, json: async () => [{ id: 'survey-1', name: 'Doorstep Survey' }] };
			}
			if (url.includes('/api/universe/metrics/results')) {
				return { ok: true, json: async () => [resultLocation] };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		})
	);

	const { getByLabelText, getByRole, getByText } = render(UniverseMetricsPage, {
		props: {
			orgSlug: 'test-org',
			buckets: [{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' }]
		}
	});

	await getByLabelText('Bucket').selectOptions('bucket-1');
	await expect.element(getByLabelText('Survey')).toBeVisible();
	await getByLabelText('Survey').selectOptions('survey-1');
	await expect.element(getByRole('button', { name: 'View Results' })).toBeVisible();

	await getByRole('button', { name: 'View Results' }).click();

	await vi.waitFor(() => {
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('/api/universe/metrics/results?bucketId=bucket-1&surveyId=survey-1')
		);
	});

	await vi.waitFor(() => {
		if (!mapHandlers['load']) throw new Error('map not initialized yet');
	});
	fireMapEvent('load');

	await vi.waitFor(() => {
		expect(markerInstances.length).toBe(1);
	});
	markerInstances[0].element.click();

	await expect.element(getByText('Community Center')).toBeVisible();
	await expect.element(getByText('Will you vote?')).toBeVisible();
	await expect.element(getByText(/alice/)).toBeVisible();
});
