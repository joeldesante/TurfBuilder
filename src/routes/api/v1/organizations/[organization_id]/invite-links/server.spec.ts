import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const svc = vi.hoisted(() => ({
	listInviteLinks: vi.fn(),
	createInviteLink: vi.fn(),
	setSlugInvite: vi.fn()
}));
vi.mock('$lib/server/services/invite-links.service', () => svc);

import { GET, POST } from './+server';
import { PUT } from '../slug-invite/+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };

function send(handler: typeof POST | typeof PUT, body: unknown) {
	return handler({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/organizations/[organization_id]/invite-links', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('returns the links', async () => {
		svc.listInviteLinks.mockResolvedValue({ links: [], slugInviteEnabled: true });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ links: [], slugInviteEnabled: true });
		expect(svc.listInviteLinks).toHaveBeenCalledWith('u1', ORG);
	});

	it('creates a link from a date, a datetime, or no expiry', async () => {
		svc.createInviteLink.mockResolvedValue({ id: 'tok' });

		expect((await send(POST, { expires_at: '2026-12-31' })).status).toBe(201);
		await send(POST, { expires_at: '2026-12-31T00:00:00Z' });
		await send(POST, {});

		expect(svc.createInviteLink.mock.calls).toEqual([
			['u1', ORG, '2026-12-31'],
			['u1', ORG, '2026-12-31T00:00:00Z'],
			['u1', ORG, null]
		]);
	});

	it('answers 400 for an expiry that is not a date', async () => {
		await expect(send(POST, { expires_at: 'next week' })).rejects.toMatchObject({ status: 400 });
		expect(svc.createInviteLink).not.toHaveBeenCalled();
	});
});

describe('PUT /api/v1/organizations/[organization_id]/slug-invite', () => {
	it('answers 400 without a boolean', async () => {
		await expect(send(PUT, { enabled: 'yes' })).rejects.toMatchObject({ status: 400 });
	});

	it('saves the toggle and echoes it', async () => {
		const res = await send(PUT, { enabled: true });

		expect(await res.json()).toEqual({ enabled: true });
		expect(svc.setSlugInvite).toHaveBeenCalledWith('u1', ORG, true);
	});
});
