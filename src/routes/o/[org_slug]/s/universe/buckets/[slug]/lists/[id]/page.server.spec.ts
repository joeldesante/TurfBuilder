import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getListDetail } = vi.hoisted(() => ({ getListDetail: vi.fn() }));

vi.mock('$lib/server/services/lists.service', () => ({ getListDetail }));

import { load } from './+page.server';

const LIST = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

function event(id = LIST, page?: string) {
	const url = new URL(`https://x/o/acme/s/universe/buckets/b/lists/${id}`);
	if (page !== undefined) url.searchParams.set('page', page);
	return {
		params: { id, slug: 'b' },
		parent: async () => ({ bucket: { id: BUCKET } }),
		locals: { user: { id: 'u1' }, organization: { id: 'o1' } },
		url
	} as never;
}

beforeEach(() => {
	vi.clearAllMocks();
	getListDetail.mockResolvedValue({ list: { id: LIST }, entries: [], hasPdf: false });
});

describe('list detail page load', () => {
	it('answers 404 for an id that is not a uuid, without asking the service', async () => {
		await expect(load(event('nope'))).rejects.toMatchObject({ status: 404 });
		expect(getListDetail).not.toHaveBeenCalled();
	});

	it("asks the service for the page of the list in the layout's bucket", async () => {
		const data = await load(event(LIST, '3'));

		expect(getListDetail).toHaveBeenCalledWith('u1', BUCKET, LIST, 3);
		expect(data).toEqual({ list: { id: LIST }, entries: [], hasPdf: false });
	});

	it('passes the service refusal through', async () => {
		getListDetail.mockRejectedValue({ status: 404 });

		await expect(load(event())).rejects.toMatchObject({ status: 404 });
	});
});
