/**
 * The shared e2e fixtures. Specs import `test` and `expect` from here instead
 * of @playwright/test:
 *
 *   import { test, expect } from './fixtures';
 *
 * - `db`: a pg client on the e2e database, one per worker. Seeders and checks
 *   use it; the feature under test is driven through the UI.
 * - Every browser context has the map tiles stubbed (see map.ts), so map pages
 *   never depend on tiles.openfreemap.org.
 * - `world`: factories for users, orgs, members, and the records they work on,
 *   each with random names so specs can run in parallel without colliding.
 */
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { Client } from 'pg';
import { DATABASE_URL } from '../config';
import { stubMapTiles } from './map';
import { World } from './world';

export { expect };
export type { World };
export type { TestUser, TestOrg, Persona } from './world';

interface WorkerFixtures {
	db: Client;
}

interface TestFixtures {
	world: World;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	db: [
		async ({}, use) => {
			const db = new Client({ connectionString: DATABASE_URL });
			await db.connect();
			await use(db);
			await db.end();
		},
		{ scope: 'worker' }
	],

	context: async ({ context }, use) => {
		await stubMapTiles(context);
		await use(context);
	},

	world: async ({ db, browser, baseURL }, use) => {
		const world = new World(db, browser, baseURL ?? 'http://localhost:5173');
		await use(world);
		await world.dispose();
	}
});

/** A signed-in browser session for one user. */
export interface Session {
	context: BrowserContext;
	page: Page;
}

export type { Browser };
