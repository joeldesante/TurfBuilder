import { describe, it, expect } from 'vitest';
import { errorPage } from './error-page';
import { ERROR_CODES, type ErrorCode } from '$lib/shared/registries/error-codes';

describe('errorPage', () => {
	it.each(Object.keys(ERROR_CODES) as ErrorCode[])('answers %s with its status, message, and code', async (code) => {
		const res = errorPage(code);
		const html = await res.text();

		expect(res.status).toBe(ERROR_CODES[code].status);
		expect(res.headers.get('content-type')).toContain('text/html');
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(html).toContain(`<h1>${ERROR_CODES[code].status}</h1>`);
		expect(html).toContain(code);
		expect(html).toContain('/logos/default-logo.svg');
	});

	it('escapes the message', async () => {
		const original = ERROR_CODES.APP_NOT_SET_UP.message;
		(ERROR_CODES.APP_NOT_SET_UP as { message: string }).message = '<b>"x" & y</b>';
		try {
			const html = await errorPage('APP_NOT_SET_UP').text();
			expect(html).toContain('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
			expect(html).not.toContain('<b>');
		} finally {
			(ERROR_CODES.APP_NOT_SET_UP as { message: string }).message = original;
		}
	});
});
