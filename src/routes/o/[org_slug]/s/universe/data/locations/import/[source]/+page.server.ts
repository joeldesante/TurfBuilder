import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return {
		orgSlug: params.org_slug,
		source: params.source
	};
};
