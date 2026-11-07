import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, expect, test } from 'vitest';
import BetaBanner from './BetaBanner.svelte';

const storageKey = 'beta-banner-test';

const clear = () => (document.cookie = `${storageKey}=; path=/; max-age=0`);
beforeEach(clear);
afterEach(clear);

test('says the software is in early development and links to support', async () => {
	const { getByRole } = render(BetaBanner, { props: { storageKey } });

	await expect
		.element(getByRole('status'))
		.toHaveTextContent('TurfBuilder is in active early stage development');
	await expect
		.element(getByRole('link', { name: 'support@turfbuilder.org' }))
		.toHaveAttribute('href', 'mailto:support@turfbuilder.org');
});

test('closes and writes a cookie the server can read', async () => {
	const { getByRole } = render(BetaBanner, { props: { storageKey } });
	await getByRole('button', { name: 'Close banner' }).click();
	await expect.element(getByRole('status')).not.toBeInTheDocument();
	expect(document.cookie).toContain(`${storageKey}=1`);
});

test('is not rendered when the server says it was dismissed', async () => {
	const { getByRole } = render(BetaBanner, { props: { storageKey, dismissed: true } });
	await expect.element(getByRole('status')).not.toBeInTheDocument();
});
