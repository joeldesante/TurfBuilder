import { describe, expect, it } from 'vitest';
import { emailLogFiltersFromUrl } from './email-log';

describe('emailLogFiltersFromUrl', () => {
	it('reads each filter', () => {
		const url = new URL('http://x?status=failed&template=auth.reset_password&recipient=a@b.co');

		expect(emailLogFiltersFromUrl(url)).toEqual({ status: 'failed', template: 'auth.reset_password', recipient: 'a@b.co' });
	});

	it('drops an unknown status instead of failing', () => {
		expect(emailLogFiltersFromUrl(new URL('http://x?status=bogus')).status).toBeUndefined();
	});

	it('is empty without a query', () => {
		expect(emailLogFiltersFromUrl(new URL('http://x'))).toEqual({});
	});
});
