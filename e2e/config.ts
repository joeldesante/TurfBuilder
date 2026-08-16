import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.test', quiet: true });
loadEnv({ quiet: true });

if (!process.env.E2E_DATABASE_URL) {
	throw new Error('E2E_DATABASE_URL is not set. Add it to .env.test or the environment.');
}

export const DATABASE_URL = process.env.E2E_DATABASE_URL;
