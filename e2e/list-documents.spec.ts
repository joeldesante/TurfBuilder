import { test, expect, type Download, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { S3Client, CreateBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DATABASE_URL } from './config';
import { gotoHydrated, signInAsAdmin } from './helpers';

// The app stores documents in the s3 service from docker-compose.test.yml and
// hands the browser presigned links to http://s3:9090. The browser runs on the
// host, so point that name at the published port.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP s3 127.0.0.1'] } });

const STORAGE_BUCKET = 'turfbuilder-e2e';
const s3 = new S3Client({
	endpoint: 'http://localhost:9090',
	region: 'us-east-1',
	forcePathStyle: true,
	credentials: { accessKeyId: 'e2e-access-key', secretAccessKey: 'e2e-secret-key' }
});

let db: Client;

test.beforeAll(async () => {
	db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
});

test.afterAll(async () => {
	await db?.end();
});

// These routes live outside /o/[org_slug], so no layout guard protects them;
// the endpoints must turn signed-out callers away themselves.
test.describe('signed out', () => {
	const base = `/api/v1/organizations/${randomUUID()}/lists/${randomUUID()}/documents`;

	test('listing documents requires signing in', async ({ request }) => {
		const res = await request.get(base);

		expect(res.status()).toBe(401);
	});

	test('generating a document requires signing in and creates nothing', async ({ request }) => {
		const count = async () =>
			(await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM universe.list_document`))
				.rows[0].n;
		const before = await count();

		const res = await request.post(base);

		expect(res.status()).toBe(401);
		expect(await count()).toBe(before);
	});

	test('fetching a document requires signing in', async ({ request }) => {
		const res = await request.get(`${base}/${randomUUID()}`);

		expect(res.status()).toBe(401);
	});
});

test.describe('generating, downloading, and regenerating the list pdf', () => {
	// Serial: each step builds on the documents the previous one left behind.
	// Generation runs headless Chrome in the app container, so allow for it.
	test.describe.configure({ mode: 'serial', timeout: 180_000 });

	const slug = `e2e-docs-${randomUUID().slice(0, 8)}`;
	let page: Page;
	let orgId: string;
	let listId: string;
	let locationId: string;
	let listPath: string;

	interface DocumentRow {
		id: string;
		status: string;
		storage_key: string;
		deleted_at: Date | null;
	}

	async function documents(): Promise<DocumentRow[]> {
		const { rows } = await db.query<DocumentRow>(
			`SELECT id, status, storage_key, deleted_at FROM universe.list_document
			 WHERE list_id = $1 ORDER BY created_at`,
			[listId]
		);
		return rows;
	}

	async function objectExists(key: string): Promise<boolean> {
		try {
			await s3.send(new HeadObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
			return true;
		} catch {
			return false;
		}
	}

	/** Checks the download is a PDF the app asked the browser to save, and counts its pages. */
	async function pdfPages(download: Download): Promise<number> {
		expect(download.url()).toContain('response-content-disposition=attachment');
		expect(download.suggestedFilename()).toMatch(/\.pdf$/);

		const bytes = await readFile((await download.path())!);
		expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
		// Chrome writes each page as an uncompressed /Type /Page object (the
		// page tree itself is /Type /Pages), so counting them counts pages.
		return bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
	}

	async function createStorageBucket() {
		// s3 starts alongside the app but may still be booting.
		for (let attempt = 0; ; attempt++) {
			try {
				await s3.send(new CreateBucketCommand({ Bucket: STORAGE_BUCKET }));
				return;
			} catch (e) {
				const name = (e as { name?: string }).name;
				if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') return;
				if (attempt >= 30) throw e;
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	/** A location list with two unpinned locations, so no map tiles are fetched. */
	async function seedList() {
		const { rows: buckets } = await db.query<{ id: string; slug: string }>(
			`INSERT INTO universe.bucket (name, slug, org_id, filter)
			 VALUES ('E2E Bucket', 'e2e-bucket', $1, '{}') RETURNING id, slug`,
			[orgId]
		);
		const { rows: lists } = await db.query<{ id: string }>(
			`INSERT INTO universe.list (name, bucket, org_id, entity_type, expires_at)
			 VALUES ('E2E Door List', $1, $2, 'locations', now() + interval '7 days') RETURNING id`,
			[buckets[0].id, orgId]
		);
		listId = lists[0].id;

		for (const [name, address] of [
			['Quick Mart', '1 Main St'],
			['Main Street Hardware', '2 Main St']
		]) {
			const { rows: entities } = await db.query<{ id: string }>(
				`INSERT INTO universe.org_entity (org_id, type_id)
				 SELECT $1, id FROM universe.entity_type WHERE slug = 'location' RETURNING id`,
				[orgId]
			);
			const { rows: locations } = await db.query<{ id: string }>(
				`INSERT INTO universe.org_location
					(org_id, entity_id, name, address_line_1, city, state_or_region, postal_code, source)
				 VALUES ($1, $2, $3, $4, 'Springfield', 'PA', '19064', 'e2e') RETURNING id`,
				[orgId, entities[0].id, name, address]
			);
			locationId ??= locations[0].id;
			await db.query(
				`INSERT INTO universe.list_entry (list_id, record_id, record_source)
				 VALUES ($1, $2, 'org_location')`,
				[listId, locations[0].id]
			);
		}

		listPath = `/o/${slug}/s/universe/buckets/${buckets[0].slug}/lists/${listId}`;
	}

	test.beforeAll(async ({ browser }) => {
		await createStorageBucket();
		// A fresh stack starts with these empty; each run rebuilds the stack.
		await db.query(
			`UPDATE system_setting SET value = v.value
			 FROM (VALUES ('spaces.endpoint', 'http://s3:9090'),
			              ('spaces.bucket', $1),
			              ('spaces.region', 'us-east-1')) AS v(key, value)
			 WHERE system_setting.key = v.key`,
			[STORAGE_BUCKET]
		);

		// Staff pages require a verified email, and tests cannot receive the
		// verification mail setup sends.
		await db.query(`UPDATE auth.user SET email_verified = true WHERE email = 'test@example.com'`);

		page = await browser.newPage();
		await signInAsAdmin(page);

		// Created through the app so the admin gets the org's default roles.
		const res = await page.request.post('/orgs/create', {
			data: { name: 'E2E Documents', slug },
			headers: { origin: 'http://localhost:5173' }
		});
		expect(res.ok()).toBe(true);
		orgId = (
			await db.query<{ id: string }>(`SELECT id FROM auth.organization WHERE slug = $1`, [slug])
		).rows[0].id;

		await seedList();
	});

	test.afterAll(async () => {
		await page?.close();
	});

	test('generates a pdf when the list has none and downloads it', async () => {
		await gotoHydrated(page, listPath);
		const generate = page.getByRole('button', { name: 'Generate PDF' });
		await expect(generate).toBeVisible();

		const download = page.waitForEvent('download', { timeout: 150_000 });
		await generate.click();

		// Just the master list: no turfs are cut yet.
		expect(await pdfPages(await download)).toBe(1);

		const docs = await documents();
		expect(docs).toHaveLength(1);
		expect(docs[0]).toMatchObject({ status: 'ready', deleted_at: null });
		expect(await objectExists(docs[0].storage_key)).toBe(true);
		await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
	});

	test('downloads the existing pdf without generating another', async () => {
		await gotoHydrated(page, listPath);

		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download PDF' }).click();

		expect(await pdfPages(await download)).toBe(1);
		expect(await documents()).toHaveLength(1);
	});

	test('regenerates after turfs are cut, replacing the old pdf', async () => {
		const { rows: turfs } = await db.query<{ id: string }>(
			`INSERT INTO universe.turf (org_id, list_id, code, author_id, expires_at)
			 SELECT $1, $2, $3, id, now() + interval '7 days' FROM auth.user WHERE email = 'test@example.com'
			 RETURNING id`,
			[orgId, listId, `E2E-${randomUUID().slice(0, 6).toUpperCase()}`]
		);
		await db.query(
			`INSERT INTO universe.turf_location (org_id, turf_id, org_location_id) VALUES ($1, $2, $3)`,
			[orgId, turfs[0].id, locationId]
		);
		const [previous] = await documents();

		await gotoHydrated(page, listPath);
		const download = page.waitForEvent('download', { timeout: 150_000 });
		await page.getByRole('button', { name: 'More PDF options' }).click();
		await page.getByRole('menuitem', { name: 'Regenerate PDF' }).click();

		// Master list, turf checkout list, and one page for the new turf.
		expect(await pdfPages(await download)).toBe(3);

		const [old, current] = await documents();
		expect(old.id).toBe(previous.id);
		expect(old.deleted_at).not.toBeNull();
		expect(current).toMatchObject({ status: 'ready', deleted_at: null });
		// Soft delete: the old file stays in storage until retention removes it.
		expect(await objectExists(old.storage_key)).toBe(true);
		expect(await objectExists(current.storage_key)).toBe(true);
	});

	test('deleting the current pdf leaves the list with none to download', async () => {
		const current = (await documents()).find((d) => d.deleted_at === null)!;

		const res = await page.request.delete(
			`/api/v1/organizations/${orgId}/lists/${listId}/documents/${current.id}`,
			{ headers: { origin: 'http://localhost:5173' } }
		);
		expect(res.status()).toBe(204);

		expect((await documents()).every((d) => d.deleted_at !== null)).toBe(true);
		// Soft delete: the file stays until retention removes it.
		expect(await objectExists(current.storage_key)).toBe(true);

		await gotoHydrated(page, listPath);
		await expect(page.getByRole('button', { name: 'Generate PDF' })).toBeVisible();
	});
});
