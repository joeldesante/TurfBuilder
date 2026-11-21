import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

/**
 * CI splits the suite across several jobs (.github/workflows/test.yml). There
 * the instance-wide tests get a job of their own, after setup; locally they run
 * as setup's teardown, after everything else.
 */
const SHARDED = process.env.E2E_SHARDED === '1';

export default defineConfig({
	testDir: 'e2e',
	// The dev container compiles routes on demand, so the first navigation of a run can be slow.
	timeout: 120_000,
	// Every test makes its own org and users (e2e/fixtures/world.ts), so tests
	// run in parallel, files included, and CI shards split by test rather than
	// by file. A file whose tests build on each other says so with
	// test.describe.configure({ mode: 'serial' }).
	fullyParallel: true,
	workers: Number(process.env.E2E_WORKERS) || 2,
	// CI shards each write a blob report, and a last job merges them into one.
	reporter: process.env.CI ? [['blob'], ['list']] : 'list',
	// The app runs as a dev server and hashes passwords with scrypt, so under
	// parallel load a sign-in can take several seconds.
	expect: { timeout: 15_000 },
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure'
	},
	projects: [
		// instance runs as setup's teardown: after every project that depends on
		// setup has finished, whether or not they passed.
		{ name: 'setup', testMatch: /setup\.spec\.ts/, teardown: SHARDED ? undefined : 'instance' },
		{ name: 'schema', testMatch: /schema\.spec\.ts/, dependencies: ['setup'] },
		// Every feature spec: e2e/<area>.spec.ts and the API checks in e2e/api/.
		{
			name: 'app',
			testMatch: /\.spec\.ts$/,
			testIgnore: [/setup\.spec\.ts/, /schema\.spec\.ts/, /instance\.spec\.ts/],
			dependencies: ['setup']
		},
		// Tests that change instance-wide settings, run alone after the rest so
		// no parallel test sees the instance changed.
		{
			name: 'instance',
			testMatch: /instance\.spec\.ts/,
			dependencies: SHARDED ? ['setup'] : []
		}
	],
	webServer: {
		command:
			'docker compose -f docker-compose.test.yml down -v && docker volume prune -f --filter "label=com.docker.compose.project=turfbuilder-e2e" && docker compose -f docker-compose.test.yml up --build --remove-orphans',
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
