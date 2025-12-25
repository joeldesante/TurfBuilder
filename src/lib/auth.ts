import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { env } from '$env/dynamic/private';
import { anonymous } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";

export const auth = betterAuth({
    database: new Pool({
        connectionString: env.DATABASE_URL
    }),
    emailAndPassword: { 
        enabled: true, 
    },
    plugins: [
        anonymous(),
        sveltekitCookies(getRequestEvent)
    ]
});