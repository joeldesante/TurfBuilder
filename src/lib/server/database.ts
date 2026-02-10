import { Pool } from "pg";
import { env } from "$env/dynamic/private";

export const POOL = new Pool({
    connectionString: env.DATABASE_URL
});

POOL.on('error', (err) => {
    console.error('Unexpected Database Error:', err)
});

POOL.on('connect', () => {
    console.error('Pool Connected...')
});

POOL.on('release', () => {
    console.error('Pool Released Connection...')
});

process.on('SIGTERM', async () => {
    await POOL.end();
    process.exit(0);
});