// The email template endpoints. Each answers 401 signed out, 400 for a bad key
// or body, and otherwise hands its input to the service.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	listEmailTemplates: vi.fn(async () => []),
	getEmailTemplate: vi.fn(async () => ({ key: 'auth.reset_password' })),
	updateEmailTemplate: vi.fn(async () => ({ key: 'auth.reset_password' })),
	resetEmailTemplate: vi.fn(async () => ({ key: 'auth.reset_password' })),
	sendTemplateTest: vi.fn(async () => ({ to: 'grace@example.com' }))
}));
vi.mock('$lib/server/services/email-templates.service', () => svc);

import * as list from './+server';
import * as one from './[template_key]/+server';
import * as testSends from './[template_key]/test-sends/+server';
import * as resets from './[template_key]/resets/+server';

type Handler = (e: never) => Response | Promise<Response>;
const KEY = 'auth.reset_password';
const signedIn = { user: { id: 'u1' } };
const body = { subject: 'Hi', htmlBody: '<p>x</p>' };

function call(handler: Handler, params: Record<string, string>, payload?: unknown, locals: unknown = signedIn) {
	return handler({
		params,
		locals,
		request: new Request('http://x', { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

const keyed: [string, Handler, ReturnType<typeof vi.fn>, unknown[], unknown?][] = [
	['GET template', one.GET, svc.getEmailTemplate, ['u1', KEY]],
	['PUT template', one.PUT, svc.updateEmailTemplate, ['u1', KEY, body], body],
	['POST test-sends', testSends.POST, svc.sendTemplateTest, ['u1', KEY, body], body],
	['POST resets', resets.POST, svc.resetEmailTemplate, ['u1', KEY]]
];

describe.each(keyed)('%s', (_name, handler, service, args, payload) => {
	it('answers 401 when signed out', async () => {
		await expect(call(handler, { template_key: KEY }, payload, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed key', async () => {
		await expect(call(handler, { template_key: '../etc' }, payload)).rejects.toMatchObject({ status: 400 });
		expect(service).not.toHaveBeenCalled();
	});

	it('hands the key and body to the service', async () => {
		const res = await call(handler, { template_key: KEY }, payload);

		expect(res.status).toBe(200);
		expect(service).toHaveBeenCalledWith(...args);
	});
});

describe.each(keyed.filter((k) => k[4] !== undefined && k[0] !== 'POST test-sends'))('%s body', (_name, handler) => {
	it('answers 400 when the subject is empty', async () => {
		await expect(call(handler, { template_key: KEY }, { subject: '', htmlBody: 'x' })).rejects.toMatchObject({ status: 400 });
	});
});

describe('POST test-sends', () => {
	it('accepts no body, to send the saved template', async () => {
		await call(testSends.POST, { template_key: KEY }, {});

		expect(svc.sendTemplateTest).toHaveBeenCalledWith('u1', KEY, {});
	});
});

describe('GET /email-templates', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(list.GET as Handler, {}, undefined, {})).rejects.toMatchObject({ status: 401 });
	});

	it('lists templates', async () => {
		const res = await call(list.GET as Handler, {});

		expect(svc.listEmailTemplates).toHaveBeenCalledWith('u1');
		expect(res.status).toBe(200);
	});
});
