import { describe, it, expect } from 'vitest';
import { parseSettingsUpdate, SETTING_GROUPS, SYSTEM_SETTINGS } from './system-settings';

describe('SYSTEM_SETTINGS', () => {
	it('puts every setting in a known group', () => {
		const groups = new Set(SETTING_GROUPS.map((g) => g.id));
		for (const setting of SYSTEM_SETTINGS) expect(groups.has(setting.group)).toBe(true);
	});

	it('has unique keys', () => {
		const keys = SYSTEM_SETTINGS.map((s) => s.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('accepts each default value', () => {
		for (const setting of SYSTEM_SETTINGS) {
			expect(setting.schema.safeParse(setting.defaultValue).success, setting.key).toBe(true);
		}
	});
});

describe('parseSettingsUpdate', () => {
	it('accepts valid values and normalizes them', () => {
		expect(
			parseSettingsUpdate({ base_url: ' https://a.example.com \n\nhttps://b.example.com ', 'errors.cat_gifs': 'false' })
		).toEqual({
			success: true,
			data: { base_url: 'https://a.example.com\nhttps://b.example.com', 'errors.cat_gifs': 'false' }
		});
	});

	it('rejects unknown keys rather than ignoring them', () => {
		expect(parseSettingsUpdate({ 'nope.key': 'x' })).toEqual({ success: false, errors: { 'nope.key': 'Unknown setting.' } });
	});

	it('reports each invalid value under its key', () => {
		const result = parseSettingsUpdate({
			base_url: 'ftp://files.example.com',
			'mail.transport': 'pigeon',
			'activity.retention_days': '-1',
			'links.custom': '[{"label":"","url":"javascript:alert(1)"}]'
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(Object.keys(result.errors).sort()).toEqual(
				['activity.retention_days', 'base_url', 'links.custom', 'mail.transport'].sort()
			);
		}
	});

	it('accepts custom links with labels and http addresses', () => {
		const result = parseSettingsUpdate({ 'links.custom': '[{"label":"Grafana","url":"https://grafana.example.com"}]' });
		expect(result.success).toBe(true);
	});

	it('rejects an empty body', () => {
		expect(parseSettingsUpdate({})).toMatchObject({ success: false });
		expect(parseSettingsUpdate(null)).toMatchObject({ success: false });
		expect(parseSettingsUpdate(['x'])).toMatchObject({ success: false });
	});
});
