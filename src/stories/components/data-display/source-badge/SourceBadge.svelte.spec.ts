import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import SourceBadge from './SourceBadge.svelte';

describe('SourceBadge', () => {
	it('names the service and the publisher', async () => {
		render(SourceBadge, { props: { provider: 'hub', publisher: 'City of Philadelphia' } });

		await expect.element(page.getByText('ArcGIS Hub: City of Philadelphia')).toBeVisible();
		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('names just the service when there is no publisher', async () => {
		render(SourceBadge, { props: { provider: 'socrata' } });

		await expect.element(page.getByText('City portals (Socrata)')).toBeVisible();
	});

	it('links to the source in a new tab when it has an address', async () => {
		render(SourceBadge, {
			props: { provider: 'datagov', publisher: 'Interior', href: 'https://catalog.data.gov/dataset/x' }
		});

		const link = page.getByRole('link', { name: /data\.gov: Interior/ });
		await expect.element(link).toHaveAttribute('href', 'https://catalog.data.gov/dataset/x');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
	});
});
