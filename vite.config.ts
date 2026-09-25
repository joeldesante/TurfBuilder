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

// A fresh object per project: Vitest names each browser instance after its
// project by writing to this config, so a shared object would give both
// client projects the same name.
const browserTest = () => ({
	enabled: true,
	provider: playwright(),
	instances: [{ browser: 'chromium' as const, headless: true }],
	// Off: a PNG per failing test piles up in __screenshots__ folders across
	// src/ and fills the disk. The failure message is enough.
	screenshotFailures: false
});

/**
 * Component specs that call vi.mock(). Vitest's browser mocker registers
 * mocks as Playwright routes on the shared browser context, so two files
 * mocking the same module in one run can both answer a request and crash it
 * ("route.fulfill: Route is already handled!"), even one file at a time.
 * scripts/test-mocking-specs.mjs runs each of these in its own Vitest process.
 * Add any new component spec that uses vi.mock() here.
 */
const mockingSpecs = [
	'src/stories/components/data-display/locations-map/LocationsMap.svelte.spec.ts',
	'src/stories/pages/o/map/TurfMapPage.svelte.spec.ts',
	'src/stories/pages/o/s/universe/data/locations/UniverseDataLocationsPage.svelte.spec.ts',
	'src/stories/pages/o/s/universe/data/locations/import/OvertureImportPage.svelte.spec.ts',
	'src/stories/pages/o/s/universe/metrics/UniverseMetricsPage.svelte.spec.ts',
	'src/stories/pages/orgs/OrgPicker.svelte.spec.ts'
];

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
		hmr: process.env.NO_HMR === 'true' ? false : undefined,
		fs: {
			// Allow serving files from the main repo root (needed for git worktrees
			// where node_modules is in the main repo, not the worktree)
			allow: [searchForWorkspaceRoot(process.cwd()), mainRepoRoot]
		},
		watch: {
			// Docker on macOS doesn't forward inotify events across the VM boundary;
			// polling is the only reliable way to detect file changes in a volume mount.
			usePolling: process.env.DOCKER === 'true'
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: browserTest(),
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**', ...mockingSpecs]
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'client-mocks',
					browser: browserTest(),
					include: mockingSpecs
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
