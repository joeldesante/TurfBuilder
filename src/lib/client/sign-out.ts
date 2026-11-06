import { toast } from 'svelte-sonner';
import { authClient } from '$lib/client';

/** Signs the user out and returns to the sign-in page, or tells them it did not work. */
export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
		window.location.href = '/auth/signin';
	} catch {
		toast.error('You could not be signed out. Try again.');
	}
}
