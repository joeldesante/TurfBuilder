import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { searchForWorkspaceRoot } from 'vite';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Find the repo root that contains the real node_modules.
// In git worktrees the packages live in the main repo, not the worktree,
// so we resolve through Node's module resolution to find it.
const require = createRequire(import.meta.url);
const mainRepoRoot = resolve(require.resolve('vite/package.json'), '../../..');

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting()],
	ssr: {
		external: [
			'@opentelemetry/sdk-node',
			'@opentelemetry/auto-instrumentations-node',
			'@opentelemetry/exporter-trace-otlp-proto',
			'import-in-the-middle',
		]
	},
	// Use browser entry points when running Vitest (recommended by Svelte docs)
	resolve: process.env.VITEST
		? {
				conditions: ['browser']
			}
		: undefined,
	server: {
		fs: {
			// Allow serving files from the main repo root (needed for git worktrees
			// where node_modules is in the main repo, not the worktree)
			allow: [searchForWorkspaceRoot(process.cwd()), mainRepoRoot]
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
