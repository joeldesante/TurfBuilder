import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';

vi.mock('maplibre-gl', async () =>
	(await import('$components/__tests__/maplibre-mock')).maplibreMock()
);

vi.mock('$lib/map-style', () => ({
	getMapStyle: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/theme.svelte', () => ({
	themeStore: { theme: 'light', setTheme: vi.fn(), init: vi.fn() }
}));

import { loadMockMap, mockPins, resetMapState } from '$components/__tests__/maplibre-mock';
import UniverseMetricsPage from './UniverseMetricsPage.svelte';

beforeEach(() => {
	resetMapState();
});

test('renders an initial tab', async () => {
	const { getByText } = render(UniverseMetricsPage, { props: {} });
	await expect.element(getByText('Tab 1', { exact: true })).toBeVisible();
});

test('adds a new tab when the new tab button is clicked', async () => {
	const { getByRole, getByText } = render(UniverseMetricsPage, {
		props: {}
	});
	await getByRole('button', { name: 'New tab' }).click();
	await expect.element(getByText('Tab 2', { exact: true })).toBeVisible();
});

test('marks the clicked tab as selected', async () => {
	const { getByRole } = render(UniverseMetricsPage, {
		props: {}
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
			buckets: [{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' }]
		}
	});

	await expect.element(getByTestId('map-view')).toBeInTheDocument();
	await expect.element(getByLabelText('Bucket')).toBeVisible();
});

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
			if (url.endsWith('/surveys')) {
				return new Response(JSON.stringify([{ id: 'survey-1', name: 'Doorstep Survey' }]));
			}
			if (url.includes('/results?')) {
				return { ok: true, json: async () => [resultLocation] };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		})
	);

	const { getByLabelText, getByRole, getByText } = render(UniverseMetricsPage, {
		props: {
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
			expect.stringContaining('/api/v1/surveys/survey-1/results?bucketId=bucket-1')
		);
	});

	await loadMockMap();

	await vi.waitFor(() => {
		expect(mockPins()).toHaveLength(1);
	});
	mockPins()[0].element.click();

	await expect.element(getByText('Community Center')).toBeVisible();
	await expect.element(getByText('Will you vote?')).toBeVisible();
	await expect.element(getByText(/alice/)).toBeVisible();
});
