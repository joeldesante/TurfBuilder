import { redirect } from "@sveltejs/kit";
import { hasSystemAccess } from '$lib/auth-helpers';

export async function load({ locals }) {
    
    if(!locals.user) {
        throw redirect(303, '/auth/signin');
    }

    if (!hasSystemAccess(locals.user.role)) {
        throw redirect(303, '/');
    }

    return {};
}