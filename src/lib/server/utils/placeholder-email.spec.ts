import { describe, it, expect } from 'vitest';
import { isPlaceholderEmail } from './placeholder-email';

describe('isPlaceholderEmail', () => {
	it('is true only for the placeholder domain, whatever the case', () => {
		expect(isPlaceholderEmail('import-123@fake.com')).toBe(true);
		expect(isPlaceholderEmail('Import-123@FAKE.com')).toBe(true);
		expect(isPlaceholderEmail('ada@example.org')).toBe(false);
		expect(isPlaceholderEmail('ada@notfake.com')).toBe(false);
	});
});
