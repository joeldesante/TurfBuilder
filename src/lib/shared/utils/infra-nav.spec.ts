import { describe, it, expect } from 'vitest';
import { buildInfraNav, isInfraNavActive } from './infra-nav';
import { INFRA_PERMISSIONS } from '$lib/shared/types/infra';

const hrefs = (groups: ReturnType<typeof buildInfraNav>) => groups.flatMap((g) => g.links.map((l) => l.href));

describe('buildInfraNav', () => {
	it('is empty without access', () => {
		expect(buildInfraNav(['users.manage', 'settings.manage'])).toEqual([]);
	});

	it('shows the read-only pages with access alone', () => {
		expect(hrefs(buildInfraNav(['access']))).toEqual([
			'/infra',
			'/infra/metrics',
			'/infra/orgs',
			'/infra/users',
			'/infra/system'
		]);
	});

	it('adds pages for each further permission', () => {
		const all = hrefs(buildInfraNav([...INFRA_PERMISSIONS]));
		expect(all).toContain('/infra/admins');
		expect(all).toContain('/infra/audit');
		expect(all).toContain('/infra/settings/email/templates');
		expect(all).toContain('/infra/migrate');
	});

	it('leaves out groups the admin can open nothing in', () => {
		expect(buildInfraNav(['access']).map((g) => g.label)).toEqual([null, 'System']);
	});

	it('ends with the external tools, marked as external', () => {
		const groups = buildInfraNav(['access'], [{ label: 'Analytics', url: 'https://a.example.com' }]);
		expect(groups.at(-1)).toEqual({
			label: 'External tools',
			links: [{ label: 'Analytics', href: 'https://a.example.com', icon: 'external', external: true }]
		});
	});
});

describe('isInfraNavActive', () => {
	const all = ['/infra', '/infra/users', '/infra/settings', '/infra/settings/email/templates'];

	it('matches the overview only on itself', () => {
		expect(isInfraNavActive('/infra', '/infra', all)).toBe(true);
		expect(isInfraNavActive('/infra', '/infra/users', all)).toBe(false);
	});

	it('matches a section on its sub-pages', () => {
		expect(isInfraNavActive('/infra/users', '/infra/users/abc', all)).toBe(true);
	});

	it('lets the longer entry win', () => {
		expect(isInfraNavActive('/infra/settings', '/infra/settings/email/templates/x', all)).toBe(false);
		expect(isInfraNavActive('/infra/settings/email/templates', '/infra/settings/email/templates/x', all)).toBe(true);
	});
});
