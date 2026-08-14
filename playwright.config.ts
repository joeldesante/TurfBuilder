import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
	testDir: 'e2e',
	use: {
		baseURL: BASE_URL
	},
	webServer: {
		// Boots the full test stack (postgres + app + nats) from docker-compose.test.yml.
		// Runs in the foreground so Playwright can stop the containers on teardown.
		command: 'docker compose -f docker-compose.test.yml up --build --remove-orphans',
		url: BASE_URL,
		// First run builds the image and runs npm install inside the container.
		timeout: 600_000,
		reuseExistingServer: !process.env.CI,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
