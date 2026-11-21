import { describe, expect, it } from 'vitest';
import { plainText } from './plain-text';

describe('plainText', () => {
	it('removes html tags', () => {
		expect(plainText('<p>Street <b>centerlines</b></p><br/>for the city')).toBe('Street centerlines for the city');
	});

	it('decodes common entities and collapses whitespace', () => {
		expect(plainText('Parks &amp; recreation\n\n  &nbsp;sites')).toBe('Parks & recreation sites');
	});

	it('handles missing values and cuts to the limit', () => {
		expect(plainText(undefined)).toBe('');
		expect(plainText('a'.repeat(400))).toHaveLength(300);
	});
});
