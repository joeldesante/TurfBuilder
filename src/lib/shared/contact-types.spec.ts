import { describe, expect, it } from 'vitest';
import { contactDisplayName, isContactType, validateContactMetadata } from './contact-types';

describe('isContactType', () => {
	it('knows the registered types only', () => {
		expect(isContactType('business')).toBe(true);
		expect(isContactType('person')).toBe(false);
		expect(isContactType('toString')).toBe(false);
	});
});

describe('validateContactMetadata', () => {
	it('accepts a business with a name, including an empty one', () => {
		expect(validateContactMetadata('business', { name: 'Lazos Pizza & Grill' })).toEqual({
			ok: true,
			metadata: { name: 'Lazos Pizza & Grill' }
		});
		expect(validateContactMetadata('business', { name: '' }).ok).toBe(true);
	});

	it('rejects a missing name and fields the type does not define', () => {
		expect(validateContactMetadata('business', {}).ok).toBe(false);
		expect(validateContactMetadata('business', { name: 'A', first_name: 'B' }).ok).toBe(false);
	});

	it('rejects an unknown type', () => {
		expect(validateContactMetadata('church', { name: 'St Mary' })).toEqual({
			ok: false,
			error: 'Unknown contact type: church'
		});
	});
});

describe('contactDisplayName', () => {
	it("uses the type's rule, and is empty for metadata that does not fit", () => {
		expect(contactDisplayName('business', { name: 'Green Market' })).toBe('Green Market');
		expect(contactDisplayName('business', { nope: true })).toBe('');
	});
});
