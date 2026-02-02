import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { env } from '$env/dynamic/private';
import { twoFactor, username } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { organization } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { ac, userRole, fieldOrganizerRole, campaignManagerRole } from "$lib/permissions";
import config from "$config";


export const auth = betterAuth({
    database: new Pool({
        connectionString: env.DATABASE_URL
    }),
    emailAndPassword: { 
        enabled: true, 
    },
    plugins: [
        username(),
        twoFactor(),
        sveltekitCookies(getRequestEvent),
        organization(),
        admin({
            ac,
            roles: {
                user: userRole,
                fieldOrganizer: fieldOrganizerRole,
                campaignManager: campaignManagerRole
            },
            defaultRole: 'user',
            adminRoles: ["fieldOrganizer", "campaignManager"],
        })
    ],
    trustedOrigins: async (_) => {
        return config.base_origins
    },
});