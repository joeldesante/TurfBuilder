import { Pool } from 'pg';
import { env } from '$env/dynamic/private';

export const POOL = new Pool({
	connectionString: env.DATABASE_URL
});

export const AUTH_POOL = new Pool({
	connectionString: env.DATABASE_URL,
	options: '-c search_path=auth'
});

POOL.on('error', (err) => {
	console.error('Unexpected Database Error:', err);
});

process.on('SIGTERM', async () => {
	await POOL.end();
	process.exit(0);
});
