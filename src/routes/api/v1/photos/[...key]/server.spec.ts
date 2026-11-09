import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getPhotoUrl: vi.fn() }));

vi.mock('$lib/server/services/photos.service', () => mocks);

import { GET } from './+server';

const KEY = 'orgs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/locations/a.webp';

function call(locals: unknown = { user: { id: 'u1' } }) {
	return Promise.resolve().then(() => GET({ params: { key: KEY }, locals } as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getPhotoUrl.mockResolvedValue('https://signed.example/get');
});

describe('GET /api/v1/photos/[...key]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call({ user: null })).rejects.toMatchObject({ status: 401 });
		expect(mocks.getPhotoUrl).not.toHaveBeenCalled();
	});

	it('redirects to the presigned link', async () => {
		await expect(call()).rejects.toMatchObject({
			status: 302,
			location: 'https://signed.example/get'
		});
		expect(mocks.getPhotoUrl).toHaveBeenCalledWith('u1', KEY);
	});

	it('passes on the service refusing the key', async () => {
		mocks.getPhotoUrl.mockRejectedValue({ status: 404 });

		await expect(call()).rejects.toMatchObject({ status: 404 });
	});
});
