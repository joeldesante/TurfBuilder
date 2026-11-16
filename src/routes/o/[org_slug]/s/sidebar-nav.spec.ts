import { describe, it, expect } from 'vitest';
import { buildBucketNav } from './sidebar-nav';

describe('buildBucketNav', () => {
	it('puts Settings in its own section, after the others', () => {
		const sections = buildBucketNav('acme', 'voters').flatMap((entry) =>
			entry.kind === 'section' ? [entry.section] : []
		);

		const last = sections[sections.length - 1];
		expect(last.label).toBe('Manage');
		expect(last.items).toEqual([
			expect.objectContaining({
				label: 'Settings',
				href: '/o/acme/s/universe/buckets/voters/settings'
			})
		]);
	});

	it('keeps Settings out of the Entities and Data sections', () => {
		const others = buildBucketNav('acme', 'voters').flatMap((entry) =>
			entry.kind === 'section' && entry.section.label !== 'Manage' ? entry.section.items : []
		);

		expect(others.some((item) => 'href' in item && item.href.endsWith('/settings'))).toBe(false);
	});

	it('shows the Settings section whether or not the bucket has people or locations', () => {
		const withNothing = buildBucketNav('acme', 'voters', {
			people: { enabled: false },
			locations: { enabled: false }
		});

		expect(
			withNothing.some((entry) => entry.kind === 'section' && entry.section.label === 'Manage')
		).toBe(true);
	});
});
