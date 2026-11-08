import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
	testDir: 'e2e',
	// The dev container compiles routes on demand, so the first navigation of a run can be slow.
	timeout: 120_000,
	// Spec files run in parallel; the tests inside one file run in order. Each
	// spec makes its own org and users (e2e/fixtures/world.ts), so files never
	// share rows. The dev server and its Chrome are the bottleneck, not tests.
	workers: Number(process.env.E2E_WORKERS) || 2,
	// The app runs as a dev server and hashes passwords with scrypt, so under
	// parallel load a sign-in can take several seconds.
	expect: { timeout: 15_000 },
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'setup', testMatch: /setup\.spec\.ts/ },
		{ name: 'schema', testMatch: /schema\.spec\.ts/, dependencies: ['setup'] },
		// Every feature spec: e2e/<area>.spec.ts and the API checks in e2e/api/.
		{
			name: 'app',
			testMatch: /\.spec\.ts$/,
			testIgnore: [/setup\.spec\.ts/, /schema\.spec\.ts/],
			dependencies: ['setup']
		}
	],
	webServer: {
		command: 'docker compose -f docker-compose.test.yml down -v && docker volume prune -f --filter "label=com.docker.compose.project=turfbuilder-e2e" && docker compose -f docker-compose.test.yml up --build --remove-orphans',
		// A static file: the app answers every page with 503 until the setup project has migrated and set up the database.
		url: `${BASE_URL}/robots.txt`,
		timeout: 600_000,
		// Do NOT set to true. We WANT the server to start from scratch each time.
		// E2E_REUSE=1 is only for writing tests against a stack you started with
		// `docker compose -f docker-compose.test.yml up` (run with --no-deps so
		// setup is not repeated); every real run, including CI, rebuilds.
		reuseExistingServer: process.env.E2E_REUSE === '1',
		gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
