import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { LOCATIONS } from './fixtures/data';
import type { World } from './fixtures';

// What staff learn from canvassing: the dashboard, the metrics page, and
// search (the header search box and the Quick Search query builder).

/** Four doors on a turf; two visited (one conversation), two not. */
async function canvassed(world: World) {
	const org = await world.createOrg();
	const staff = await world.as(org, 'admin');
	await world.importLocations(staff, org, LOCATIONS);
	const bucket = await world.createBucket(staff, org);
	const list = await world.createList(staff, bucket.id);
	const survey = await world.createSurvey(staff, bucket.id);
	const turf = await world.createTurf(staff, org, { listId: list.id, surveyId: survey.id });
	const volunteer = await world.as(org, 'volunteer');
	await world.joinTurf(org, volunteer.user, turf.id);
	const doors = await world.turfDoors(turf.id);
	const bell = doors.find((d) => d.name === 'Liberty Bell')!;
	const hall = doors.find((d) => d.name === 'City Hall')!;
	await world.recordVisit(volunteer, org, turf.id, bell.id, {
		contacted: true,
		answers: { [survey.questions[0].id]: 'Yes' }
	});
	await world.recordVisit(volunteer, org, turf.id, hall.id, { contacted: false });
	return { org, staff, bucket, survey };
}

test.describe('the dashboard', () => {
	test('shows how much of the universe has been visited, and filters by bucket and range', async ({
		world
	}) => {
		const { org, staff, bucket } = await canvassed(world);
		const page = staff.page;

		await gotoHydrated(page, `/o/${org.slug}/s`);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		const progress = page.getByRole('region', { name: 'Progress' });
		await expect(progress.getByRole('img', { name: '50% visited' })).toBeVisible();
		await expect(progress).toContainText('Conversations');

		await page.getByText('7 days', { exact: true }).click();
		await expect(page).toHaveURL(/range=7d/);
		await expect(progress.getByRole('img', { name: '50% visited' })).toBeVisible();

		await page.getByRole('button', { name: /Change bucket/ }).click();
		await page.getByRole('menuitem', { name: bucket.name }).click();
		await expect(page).toHaveURL(new RegExp(`bucket=${bucket.slug}`));
		await expect(progress.getByRole('img', { name: '50% visited' })).toBeVisible();
	});

	test('a new organization shows nothing visited', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'owner');

		await gotoHydrated(page, `/o/${org.slug}/s`);
		await expect(page.getByRole('img', { name: '0% visited' })).toBeVisible();
	});
});

test.describe('metrics', () => {
	test('picking a bucket and survey shows the responses, and a door shows its answers', async ({
		world
	}) => {
		const { org, staff, bucket, survey } = await canvassed(world);
		const page = staff.page;

		await gotoHydrated(page, `/o/${org.slug}/s/universe/metrics`);
		await page.getByLabel('Bucket').selectOption({ label: bucket.name });
		await page.getByLabel('Survey').selectOption(survey.id);
		await page.getByRole('button', { name: 'View Results' }).click();

		const door = page.getByRole('button', { name: /Liberty Bell/ });
		await expect(door).toBeAttached();
		await door.focus();
		await door.press('Enter');
		await expect(page.getByText('Will you vote?').first()).toBeVisible();
		await expect(page.getByText('Yes').first()).toBeVisible();
	});

	test('the results endpoint answers with the canvassed doors and their responses', async ({
		world
	}) => {
		const { staff, bucket, survey } = await canvassed(world);

		const res = await staff.request.get(
			`/api/v1/surveys/${survey.id}/results?bucketId=${bucket.id}`
		);
		expect(res.ok()).toBe(true);
		const results = (await res.json()) as {
			name: string;
			questions: { responses: { value: string }[] }[];
		}[];
		const bell = results.find((r) => r.name === 'Liberty Bell');
		expect(bell?.questions[0].responses.map((r) => r.value)).toEqual(['Yes']);
	});

	test('the universe stats endpoint answers for staff', async ({ world }) => {
		const { org, staff } = await canvassed(world);

		const res = await staff.request.get(`/api/v1/organizations/${org.id}/universe-stats`);
		expect(res.ok()).toBe(true);
	});
});

test.describe('metrics tabs', () => {
	test('a new tab starts its own workflow; tabs can be switched and closed', async ({ world }) => {
		const org = await world.createOrg();
		const { page } = await world.as(org, 'admin');

		await gotoHydrated(page, `/o/${org.slug}/s/universe/metrics`);
		const tabs = page.getByRole('tablist');
		await expect(tabs.getByRole('tab')).toHaveCount(1);

		await page.getByRole('button', { name: 'New tab' }).click();
		await expect(tabs.getByRole('tab')).toHaveCount(2);
		await expect(tabs.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');

		await tabs.getByRole('tab').first().click();
		await expect(tabs.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');

		await page.getByRole('button', { name: /^Close Tab 2/ }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Close tab' }).click();
		await expect(tabs.getByRole('tab')).toHaveCount(1);
	});
});

test.describe('search', () => {
	test('the header search finds a location by name and opens it', async ({ world }) => {
		const { org, staff } = await canvassed(world);
		const page = staff.page;

		await gotoHydrated(page, `/o/${org.slug}/s`);
		await page.keyboard.press('Control+k');
		await page.getByPlaceholder('Search...').fill('Liberty');
		// The map's marker for the same door is a button too; the result also shows the address.
		await page.getByRole('button', { name: /^Liberty Bell 526 Market St/ }).click();
		await expect(page).toHaveURL(/\/universe\/(entity|data|buckets)\//);
	});

	test("search never returns another org's records", async ({ world }) => {
		await canvassed(world);
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');

		const res = await staff.request.get(`/api/v1/organizations/${org.id}/search?q=Liberty`);
		expect(res.ok()).toBe(true);
		expect(JSON.stringify(await res.json())).not.toContain('Liberty Bell');
	});

	test('Quick Search is for infra admins only, and refuses anything but plain names', async ({
		world
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'owner');

		expect((await staff.page.goto(`/o/${org.slug}/s/universe/search`))?.status()).toBe(403);
		const stolen = await staff.request.post(`/api/v1/queries`, {
			data: { queries: [{ select: ['*'], from: 'auth.account' }] }
		});
		expect(stolen.status()).toBe(403);

		const admin = await world.admin();
		await world.addMember(
			org,
			{
				id: (await world.db.query(`SELECT id FROM auth."user" WHERE email = 'test@example.com'`))
					.rows[0].id
			},
			{ role: 'Administrator' }
		);
		const injected = await admin.request.post(`/api/v1/queries`, {
			data: { queries: [{ select: ['*'], from: 'auth.account' }] }
		});
		expect(injected.status()).toBe(400);
		const ok = await admin.request.post(`/api/v1/queries`, {
			data: { queries: [{ select: ['code'], from: 'universe.turf' }] }
		});
		expect(ok.status()).toBe(200);
		await gotoHydrated(admin.page, `/o/${org.slug}/s/universe/search`);
		await expect(admin.page.getByText('Schema Browser')).toBeVisible();
	});
});
