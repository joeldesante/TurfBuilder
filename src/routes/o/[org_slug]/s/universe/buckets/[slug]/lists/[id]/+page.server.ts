import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { requestedPage } from '$lib/shared/utils/pagination';
import { getListDetail } from '$lib/server/services/lists.service';

export async function load({ params, parent, locals, url }) {
	if (!z.uuid().safeParse(params.id).success) throw error(404, 'List not found');
	const { bucket } = await parent();

	return getListDetail(locals.user!.id, bucket.id, params.id, requestedPage(url));
}
