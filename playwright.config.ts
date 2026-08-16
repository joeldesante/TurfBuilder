import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
	testDir: 'e2e',
	// The dev container compiles routes on demand, so the first navigation of a run can be slow.
	timeout: 120_000,
	use: {
		baseURL: BASE_URL
	},
	projects: [
		{ name: 'setup', testMatch: /setup\.spec\.ts/ },
		{ name: 'schema', testMatch: /schema\.spec\.ts/, dependencies: ['setup'] },
		{ name: 'auth', testMatch: /auth\.spec\.ts/, dependencies: ['setup'] }
	],
	webServer: {
		command: 'docker compose -f docker-compose.test.yml down -v && docker volume prune -f --filter "label=com.docker.compose.project=turfbuilder-e2e" && docker compose -f docker-compose.test.yml up --build --remove-orphans',
		url: BASE_URL,
		timeout: 600_000,
		reuseExistingServer: false,		// Do NOT set to true. We WANT the server to start from scratch each time.
		gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
