import { describe, it, expect } from 'vitest';
import plugin, { type Alert } from './index';

describe('rapid-response-alert-feed plugin manifest', () => {
	it('has the correct slug', () => {
		expect(plugin.slug).toBe('rapid-response-alert-feed');
	});

	it('has a name and version', () => {
		expect(plugin.name).toBeTruthy();
		expect(plugin.version).toBeTruthy();
	});

	it('has a description', () => {
		expect(plugin.description).toBeTruthy();
	});

	it('navEntries returns an array for a given orgSlug', () => {
		const entries = plugin.navEntries!('test-org');
		expect(Array.isArray(entries)).toBe(true);
		expect(entries.length).toBeGreaterThan(0);
	});

	it('navEntries href includes the orgSlug and plugin slug', () => {
		const entries = plugin.navEntries!('my-org');
		const item = entries[0] as { kind: string; item: { label: string; href: string } };
		expect(item.item.href).toContain('my-org');
		expect(item.item.href).toContain('rapid-response-alert-feed');
	});

	it('has a staff pages index', () => {
		expect(plugin.pages?.index).toBeTruthy();
	});

	it('has a volunteer pages index', () => {
		expect(plugin.volunteerPages?.index).toBeTruthy();
	});

	it('serverLoad returns an object with an alerts array', async () => {
		const result = await plugin.serverLoad!('', {} as any);
		expect(result).toHaveProperty('alerts');
		expect(Array.isArray((result as { alerts: Alert[] }).alerts)).toBe(true);
	});

	it('returned alerts have required fields', async () => {
		const result = await plugin.serverLoad!('', {} as any) as { alerts: Alert[] };
		for (const alert of result.alerts) {
			expect(alert.id).toBeTruthy();
			expect(alert.title).toBeTruthy();
			expect(alert.body).toBeTruthy();
			expect(['urgent', 'info', 'update']).toContain(alert.category);
			expect(alert.author).toBeTruthy();
			expect(alert.publishedAt).toBeTruthy();
		}
	});
});
