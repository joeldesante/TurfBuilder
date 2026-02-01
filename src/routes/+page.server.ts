import { redirect } from "@sveltejs/kit";

export async function load({ locals, params, fetch }) {
    
    if(!locals.user) {
        redirect(302, '/auth/signin');
    }

    if(!locals.user.twoFactorEnabled) {
        redirect(302, '/auth/2fa/setup');
    }

    return {}
}