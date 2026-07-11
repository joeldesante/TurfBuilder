import {
	adminClient,
	usernameClient,
	organizationClient,
	twoFactorClient,
	jwtClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte'; // make sure to import from better-auth/svelte

export const authClient = createAuthClient({
	plugins: [usernameClient(), twoFactorClient(), organizationClient(), adminClient(), jwtClient()]
});
