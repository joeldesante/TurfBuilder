#!/usr/bin/env node
/**
 * Runs each spec in the `client-mocks` Vitest project in its own process.
 *
 * These component specs call vi.mock(). Vitest's browser mocker registers
 * mocks as Playwright routes on the browser context the whole run shares, so
 * two files mocking the same module can both answer one request and crash the
 * run ("route.fulfill: Route is already handled!"), even one file at a time.
 * A separate process per file gets a fresh browser context each time. The
 * list of files lives in vite.config.ts (`mockingSpecs`).
 *
 * Usage: node scripts/test-mocking-specs.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';

const listed = execFileSync(
	'npx',
	['vitest', 'list', '--project', 'client-mocks', '--filesOnly', '--json'],
	{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);
const files = JSON.parse(listed).map((entry) => entry.file);

if (files.length === 0) {
	console.error('No specs found in the client-mocks project.');
	process.exit(1);
}

const failed = [];
for (const file of files) {
	const result = spawnSync('npx', ['vitest', 'run', '--project', 'client-mocks', file], {
		stdio: 'inherit'
	});
	if (result.status !== 0) failed.push(file);
}

if (failed.length > 0) {
	console.error(`\n${failed.length} of ${files.length} mocking specs failed:`);
	for (const file of failed) console.error(`  ${file}`);
	process.exit(1);
}
console.log(`\nAll ${files.length} mocking specs passed.`);
