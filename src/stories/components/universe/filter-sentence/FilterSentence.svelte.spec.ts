import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import FilterSentence from './FilterSentence.svelte';
import type { SentencePart } from '$lib/shared/utils/filter-sentence';

const parts: SentencePart[] = [
	{ text: 'Select only ' },
	{ text: 'People', badge: true },
	{ text: ' who live within ' },
	{ text: '2 miles', badge: true },
	{ text: ' of ' },
	{ text: '39.9500, -75.1600', badge: true, view: 'radius' }
];

test('reads as one sentence with the words kept together', async () => {
	const { container } = render(FilterSentence, { props: { parts } });

	expect(container.textContent?.trim()).toBe(
		'Select only People who live within 2 miles of 39.9500, -75.1600'
	);
});

test('highlights the settings but not the plain words', async () => {
	const { getByText } = render(FilterSentence, { props: { parts } });

	await expect.element(getByText('People', { exact: true })).toHaveClass('rounded-md');
	await expect.element(getByText('Select only', { exact: false })).not.toHaveClass('rounded-md');
});

test('draws a setting that is missing so it stands out', async () => {
	const { getByText } = render(FilterSentence, {
		props: { parts: [{ text: 'no text yet', badge: true, incomplete: true }] }
	});

	await expect.element(getByText('no text yet')).toHaveClass('bg-warning-container');
});

test('scrolls sideways instead of wrapping', async () => {
	const { container } = render(FilterSentence, { props: { parts } });

	const line = container.querySelector('p')!;
	expect(line.className).toContain('overflow-x-auto');
	expect(line.className).toContain('whitespace-nowrap');
});

test('puts each clause on its own line on a phone, and reads as one sentence otherwise', async () => {
	const { container } = render(FilterSentence, {
		props: {
			parts: [
				{ text: 'Select only ' },
				{ text: 'People', badge: true },
				{ text: ' ', break: true },
				{ text: 'who live within ' },
				{ text: '2 miles', badge: true }
			]
		}
	});

	const clauses = [...container.querySelectorAll('p > span')];
	expect(clauses.map((c) => c.textContent)).toEqual([
		'Select only People',
		'who live within 2 miles'
	]);
	expect(clauses.every((c) => c.classList.contains('max-sm:block'))).toBe(true);
	expect(container.textContent?.trim()).toBe('Select only People who live within 2 miles');
});

test('opens the editor when a setting is pressed', async () => {
	const onedit = vi.fn();
	const { getByRole } = render(FilterSentence, { props: { parts, onedit } });

	await getByRole('button', { name: '2 miles' }).click();

	expect(onedit).toHaveBeenCalledOnce();
});

test('leaves the settings as plain text when nothing edits them', async () => {
	const { getByRole } = render(FilterSentence, { props: { parts } });

	await expect.element(getByRole('button', { name: '2 miles' })).not.toBeInTheDocument();
});

test('offers to view a setting on a map and says which', async () => {
	const onview = vi.fn();
	const { getByRole } = render(FilterSentence, { props: { parts, onview } });

	await getByRole('button', { name: 'View on map' }).click();

	expect(onview).toHaveBeenCalledWith('radius');
});

test('has no map button when nothing can be viewed or no one listens', async () => {
	const none = render(FilterSentence, { props: { parts: parts.slice(0, 2), onview: vi.fn() } });
	await expect.element(none.getByRole('button', { name: 'View on map' })).not.toBeInTheDocument();
	none.unmount();

	const { getByRole } = render(FilterSentence, { props: { parts } });
	await expect.element(getByRole('button', { name: 'View on map' })).not.toBeInTheDocument();
});
