import { redirect } from '@sveltejs/kit';
import { acceptInvite, getInvite } from '$lib/server/services/invite-links.service';

export async function load({ params, locals }) {
	const invite = await getInvite(params.token, locals.user?.id ?? null);

	// Must be signed in to join.
	if (!locals.user) throw redirect(303, `/auth/signin?redirectTo=/invite/${params.token}`);

	return {
		orgId: invite.orgId,
		orgName: invite.orgName,
		orgSlug: invite.orgSlug,
		alreadyMember: invite.alreadyMember
	};
}

export const actions = {
	join: async ({ params, locals }) => {
		if (!locals.user) throw redirect(303, `/auth/signin?redirectTo=/invite/${params.token}`);

		const { orgSlug } = await acceptInvite(locals.user.id, params.token);
		throw redirect(303, `/o/${orgSlug}`);
	}
};
