import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { LOCATIONS } from './fixtures/data';
import type { World } from './fixtures';
import type { Page } from '@playwright/test';

/** Selects a door on the map from the keyboard; zoomed out, markers overlap and steal clicks. */
async function selectDoor(page: Page, name: RegExp) {
	const door = page.getByRole('button', { name });
	await door.focus();
	await door.press('Enter');
}

// Canvassing: a volunteer joins a turf by its code, walks its doors on the
// map, records visits and survey answers, and suggests doors and fixes.

/** An org with a cut turf of the four sample doors, its survey (one question of each type), and script. */
async function turfWithSurvey(world: World) {
	const org = await world.createOrg();
	const staff = await world.as(org, 'admin');
	await world.importLocations(staff, org, LOCATIONS);
	const bucket = await world.createBucket(staff, org);
	const list = await world.createList(staff, bucket.id);
	const survey = await world.createSurvey(staff, bucket.id, [
		{ question_text: 'Will you vote?', question_type: 'radio', choices: ['Yes', 'No'] },
		{
			question_text: 'Which issues matter?',
			question_type: 'check',
			choices: ['Housing', 'Transit']
		},
		{ question_text: 'Anything else?', question_type: 'text' }
	]);
	const script = await world.createScript(
		staff,
		bucket.id,
		'Hi, I am volunteering for the neighborhood.'
	);
	const turf = await world.createTurf(staff, org, {
		listId: list.id,
		surveyId: survey.id,
		scriptId: script.id
	});
	return { org, staff, turf, survey };
}

/** A volunteer already on the turf. */
async function onTurf(
	world: World,
	org: Awaited<ReturnType<typeof turfWithSurvey>>['org'],
	turfId: string
) {
	const volunteer = await world.as(org, 'volunteer');
	await world.db.query(
		`INSERT INTO universe.turf_user (turf_id, user_id, org_id) VALUES ($1, $2, $3)`,
		[turfId, volunteer.user.id, org.id]
	);
	return volunteer;
}

test.describe('joining a turf', () => {
	test('the code opens the turf map', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page, user } = await world.as(org, 'volunteer');

		await gotoHydrated(page, `/o/${org.slug}/join`);
		await expect(page.getByRole('heading', { name: 'Join a Turf' })).toBeVisible();
		await page.locator('input[autocomplete="one-time-code"]').pressSequentially(turf.code);

		await expect(page).toHaveURL(new RegExp(`/map/${turf.id}$`));
		const { rowCount } = await db.query(
			`SELECT 1 FROM universe.turf_user WHERE turf_id = $1 AND user_id = $2`,
			[turf.id, user.id]
		);
		expect(rowCount).toBe(1);
	});

	test('a wrong code shows a message and stays put', async ({ world }) => {
		const { org } = await turfWithSurvey(world);
		const { page } = await world.as(org, 'volunteer');

		await gotoHydrated(page, `/o/${org.slug}/join`);
		await page.locator('input[autocomplete="one-time-code"]').pressSequentially('ZZZZZZ');

		await expect(page.getByText(/invalid code/i)).toBeVisible();
		await expect(page).toHaveURL(/\/join$/);
	});

	test('someone not on the turf cannot open its map', async ({ world }) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page } = await world.as(org, 'volunteer');

		const res = await page.goto(`/o/${org.slug}/map/${turf.id}`);
		expect(res?.status()).not.toBe(200);
	});

	test('a volunteer cannot open staff pages', async ({ world }) => {
		const { org } = await turfWithSurvey(world);
		const { page } = await world.as(org, 'volunteer');

		expect((await page.goto(`/o/${org.slug}/s`))?.status()).toBe(403);
	});
});

test.describe('walking the turf', () => {
	test('the map shows the turf’s doors, and a door opens its survey with the script', async ({
		world
	}) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page } = await onTurf(world, org, turf.id);

		await gotoHydrated(page, `/o/${org.slug}/map/${turf.id}`);
		for (const l of LOCATIONS) {
			await expect(page.getByRole('button', { name: new RegExp(String(l.name)) })).toBeAttached();
		}

		await selectDoor(page, /Liberty Bell/);
		await page.getByRole('link', { name: 'Open Location' }).click();
		await expect(page).toHaveURL(/\/location\/[0-9a-f-]+$/);
		await expect(page.getByText('What to say')).toBeVisible();
		await expect(page.getByText('Hi, I am volunteering for the neighborhood.')).toBeVisible();
	});

	test('recording a conversation saves every answer and marks the door contacted', async ({
		world,
		db
	}) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page, user } = await onTurf(world, org, turf.id);
		const [door] = await world.turfDoors(turf.id);

		await gotoHydrated(page, `/o/${org.slug}/map/${turf.id}/location/${door.id}`);
		await page.getByRole('button', { name: /Spoke with Them/ }).click();
		await page.getByRole('radiogroup', { name: 'Will you vote?' }).getByText('Yes').click();
		await page.getByRole('group', { name: 'Which issues matter?' }).getByText('Housing').click();
		await page.getByRole('group', { name: 'Which issues matter?' }).getByText('Transit').click();
		await page.getByRole('textbox', { name: 'Anything else?' }).fill('Wants a crosswalk.');
		await page.getByLabel('Notes').fill('Friendly');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL(new RegExp(`/map/${turf.id}$`));
		const { rows: attempts } = await db.query(
			`SELECT contact_made, attempt_note AS note FROM universe.turf_location_attempt WHERE turf_location_id = $1 AND user_id = $2`,
			[door.id, user.id]
		);
		expect(attempts).toEqual([{ contact_made: true, note: 'Friendly' }]);
		const { rows: answers } = await db.query<{ question_text: string; response: string }>(
			`SELECT sq.question_text, sqr.response_value AS response FROM universe.survey_question_response sqr
			 JOIN universe.survey_question sq ON sq.id = sqr.survey_question_id
			 JOIN universe.turf_location_attempt a ON a.id = sqr.turf_location_attempt_id
			 WHERE a.turf_location_id = $1 ORDER BY sq.order_index`,
			[door.id]
		);
		expect(answers.map((a) => a.question_text)).toEqual([
			'Will you vote?',
			'Which issues matter?',
			'Anything else?'
		]);
		expect(answers[0].response).toBe('Yes');
		expect(answers[1].response).toMatch(/Housing/);
		expect(answers[1].response).toMatch(/Transit/);
		expect(answers[2].response).toBe('Wants a crosswalk.');

		const status = await page.request.get(`/api/v1/turfs/${turf.id}/doors`);
		expect(status.ok()).toBe(true);
	});

	test('a door nobody answered is recorded without answers', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page } = await onTurf(world, org, turf.id);
		const [door] = await world.turfDoors(turf.id);

		await gotoHydrated(page, `/o/${org.slug}/map/${turf.id}/location/${door.id}`);
		await page.getByRole('button', { name: /No Answer/ }).click();
		await expect(page.getByRole('radiogroup', { name: 'Will you vote?' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL(new RegExp(`/map/${turf.id}$`));
		const { rows } = await db.query(
			`SELECT a.contact_made, count(sqr.id)::int AS answers FROM universe.turf_location_attempt a
			 LEFT JOIN universe.survey_question_response sqr ON sqr.turf_location_attempt_id = a.id
			 WHERE a.turf_location_id = $1 GROUP BY a.id`,
			[door.id]
		);
		expect(rows).toEqual([{ contact_made: false, answers: 0 }]);
	});
});

test.describe('suggesting doors and fixes', () => {
	test('a volunteer adds a missing business, edits it, and removes it', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page, user } = await onTurf(world, org, turf.id);

		await gotoHydrated(page, `/o/${org.slug}/map/${turf.id}`);
		await page.getByRole('button', { name: 'Business not listed' }).click();
		await expect(page.getByText('Tap the map on the business')).toBeVisible();
		const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

		await page.getByRole('textbox', { name: 'Business name' }).fill('Corner Deli');
		await page.getByRole('textbox', { name: 'Street address' }).fill('10 Main St');
		await page.getByRole('textbox', { name: 'City' }).fill('Philadelphia');
		await page.getByRole('button', { name: 'Add business' }).click();

		const pending = async () =>
			(
				await db.query(
					`SELECT c.metadata->>'name' AS name FROM universe.location_suggestion ls
					 JOIN universe.org_contact c ON c.entity_id = ls.entity_id AND c.valid_to IS NULL
					 WHERE ls.org_id = $1 AND ls.user_id = $2 AND ls.status = 'tentative'`,
					[org.id, user.id]
				)
			).rows.map((r) => r.name);
		await expect.poll(pending).toEqual(['Corner Deli']);

		await selectDoor(page, /Corner Deli/);
		await expect(page.getByText('Awaiting review').first()).toBeVisible();
		await page.getByRole('button', { name: 'Edit' }).click();
		await page.getByRole('textbox', { name: 'Business name' }).fill('Corner Deli & Grocery');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect.poll(pending).toEqual(['Corner Deli & Grocery']);

		await selectDoor(page, /Corner Deli/);
		await page.getByRole('button', { name: 'Remove' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
		await expect.poll(pending).toEqual([]);
	});

	test('a volunteer reports wrong details on a door for staff to review', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const { page, user } = await onTurf(world, org, turf.id);

		await gotoHydrated(page, `/o/${org.slug}/map/${turf.id}`);
		await selectDoor(page, /City Hall/);
		await page.getByRole('button', { name: 'Details are wrong' }).click();
		await page.getByRole('textbox', { name: 'Business name' }).fill('Philadelphia City Hall');
		await page.getByLabel('What is wrong?').fill('The full name is on the sign.');
		await page.getByRole('button', { name: 'Send correction' }).click();

		await expect(page.getByText('Your correction is waiting to be reviewed.')).toBeVisible();
		const { rows } = await db.query(
			`SELECT name, note FROM universe.location_edit_suggestion WHERE org_id = $1 AND user_id = $2`,
			[org.id, user.id]
		);
		expect(rows).toEqual([
			{ name: 'Philadelphia City Hall', note: 'The full name is on the sign.' }
		]);
	});
});

test.describe('who may suggest a door', () => {
	const door = {
		name: 'Gate Test',
		address_line_1: '1 Gate St',
		city: 'Philadelphia',
		latitude: 39.95,
		longitude: -75.16
	};

	test('a pin outside the turf is refused', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const volunteer = await onTurf(world, org, turf.id);
		await db.query(
			`UPDATE universe.turf SET bounds = ST_SetSRID(ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'), 4326) WHERE id = $1`,
			[turf.id]
		);

		const res = await volunteer.request.post(`/api/v1/turfs/${turf.id}/locations`, {
			data: door
		});
		expect(res.status()).toBeGreaterThanOrEqual(400);
		expect(res.status()).toBeLessThan(500);
	});

	test('an expired turf takes no new doors', async ({ world, db }) => {
		const { org, turf } = await turfWithSurvey(world);
		const volunteer = await onTurf(world, org, turf.id);
		await db.query(`UPDATE universe.turf SET expires_at = now() - interval '1 day' WHERE id = $1`, [
			turf.id
		]);

		const res = await volunteer.request.post(`/api/v1/turfs/${turf.id}/locations`, {
			data: door
		});
		expect(res.status()).toBeGreaterThanOrEqual(400);
		expect(res.status()).toBeLessThan(500);
	});

	test('a member not on the turf cannot add to it', async ({ world }) => {
		const { org, turf } = await turfWithSurvey(world);
		const stranger = await world.as(org, 'volunteer');

		const res = await stranger.request.post(`/api/v1/turfs/${turf.id}/locations`, {
			data: door
		});
		expect(res.status()).toBeGreaterThanOrEqual(400);
		expect(res.status()).toBeLessThan(500);
	});
});
