import { can } from '$lib/auth-helpers';
import { listPendingReviews } from '$lib/server/services/suggestions.service';

export async function load({ locals }) {
	const { suggestions, edits } = await listPendingReviews(locals.user!.id, locals.organization!.id);

	return {
		suggestions,
		edits,
		canApprove: can(locals.organization, 'location', 'create'),
		canReject: can(locals.organization, 'location', 'delete'),
		canReviewEdits: can(locals.organization, 'location', 'update')
	};
}
