import { describe, expect, it } from 'vitest';
import { emailTemplateBodySchema, testSendSchema } from './email-templates';

describe('emailTemplateBodySchema', () => {
	it('trims the subject and keeps the body as written', () => {
		expect(emailTemplateBodySchema.parse({ subject: '  Hi  ', htmlBody: ' <p>x</p> ' })).toEqual({
			subject: 'Hi',
			htmlBody: ' <p>x</p> '
		});
	});

	it('rejects an empty subject or body', () => {
		expect(emailTemplateBodySchema.safeParse({ subject: ' ', htmlBody: 'x' }).success).toBe(false);
		expect(emailTemplateBodySchema.safeParse({ subject: 'x', htmlBody: '' }).success).toBe(false);
	});
});

describe('testSendSchema', () => {
	it('accepts nothing, to send the saved template', () => {
		expect(testSendSchema.safeParse({}).success).toBe(true);
	});
});
