import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { dbApi } from './server/api';

// Developer tool, not part of the app. Run with `npm run db:browse`.
const here = fileURLToPath(new URL('.', import.meta.url));
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
	root: here,
	plugins: [svelte(), dbApi()],
	server: { host: '127.0.0.1', port: 5174, strictPort: true }
});
