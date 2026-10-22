import { describe, it, expect } from 'vitest';
import { scrubMessage, serializeError, zodIssues } from './logger';

describe('scrubMessage', () => {
	it('masks emails', () => {
		expect(scrubMessage('Invalid recipient jane.doe@example.org')).toBe('Invalid recipient [email]');
	});

	it('masks quoted values but keeps the surrounding text', () => {
		expect(scrubMessage('invalid input syntax for type uuid: "abc-123"')).toBe(
			'invalid input syntax for type uuid: "?"'
		);
	});
});

describe('serializeError', () => {
	it('drops database detail, which quotes row values', () => {
		const err = Object.assign(new Error('duplicate key value violates unique constraint "u_email"'), {
			code: '23505',
			constraint: 'u_email',
			table: 'user',
			detail: 'Key (email)=(jane@example.org) already exists.',
			parameters: ['jane@example.org']
		});
		const out = serializeError(err);
		expect(out).toMatchObject({ code: '23505', constraint: 'u_email', table: 'user' });
		expect(JSON.stringify(out)).not.toContain('jane@example.org');
		expect(out).not.toHaveProperty('detail');
		expect(out).not.toHaveProperty('parameters');
	});

	it('does not echo a thrown non-error', () => {
		expect(JSON.stringify(serializeError('secret string'))).not.toContain('secret');
	});
});

describe('zodIssues', () => {
	it('keeps paths and codes only', () => {
		expect(zodIssues({ issues: [{ path: ['records', 0, 'name'], code: 'invalid_type' }] })).toEqual([
			{ path: 'records.0.name', code: 'invalid_type' }
		]);
	});
});
