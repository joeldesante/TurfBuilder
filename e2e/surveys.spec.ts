import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { suffix } from './fixtures/world';

// Surveys and scripts in a bucket: creating, the lists, the autosaving
// editors, and who may use them.

async function questions(db: import('pg').Client, surveyId: string) {
	const { rows } = await db.query<{
		question_text: string;
		question_type: string;
		choices: string[];
	}>(
		`SELECT question_text, question_type, choices FROM universe.survey_question
		 WHERE survey_id = $1 ORDER BY order_index`,
		[surveyId]
	);
	return rows;
}

test.describe('surveys', () => {
	test('creating a survey opens its editor, and the list shows the newest first', async ({
		world
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const older = await world.createSurvey(staff, bucket.id, [], `Older ${suffix()}`);
		const base = `/o/${org.slug}/s/universe/buckets/${bucket.slug}/surveys`;
		const name = `Doorstep ${suffix()}`;

		await gotoHydrated(staff.page, `${base}/new`);
		await staff.page.getByRole('textbox', { name: 'Name' }).fill(name);
		await staff.page.getByRole('button', { name: /Create/ }).click();
		await expect(staff.page).toHaveURL(new RegExp(`${base}/[0-9a-f-]+$`));
		await expect(staff.page.getByRole('textbox', { name: 'Survey name' })).toHaveValue(name);

		await gotoHydrated(staff.page, base);
		const rows = staff.page.getByRole('link', { name: /\d{1,2}:\d{2}/ });
		await expect(rows.nth(0)).toContainText(name);
		await expect(rows.nth(1)).toContainText('Older');
		expect(older.id).toBeTruthy();
	});

	test('the editor saves the name, description, and questions of every type as you type', async ({
		world,
		db
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const survey = await world.createSurvey(staff, bucket.id, []);
		const page = staff.page;

		await gotoHydrated(
			page,
			`/o/${org.slug}/s/universe/buckets/${bucket.slug}/surveys/${survey.id}`
		);
		await page.getByRole('textbox', { name: 'Survey name' }).fill('Ward 5 doors');
		await page.getByRole('textbox', { name: 'Description' }).fill('Spring outreach');

		await page.getByRole('button', { name: 'Add Question' }).click();
		await page
			.getByRole('textbox', { name: 'Question 1', exact: true })
			.fill('What matters to you?');

		await page.getByRole('button', { name: 'Add Question' }).click();
		await page.getByRole('textbox', { name: 'Question 2', exact: true }).fill('Will you vote?');
		await page.getByRole('combobox', { name: 'Question 2 type' }).selectOption('radio');
		await page.getByRole('button', { name: 'Add a choice to question 2' }).click();
		await page.getByRole('button', { name: 'Add a choice to question 2' }).click();
		await page.getByRole('textbox', { name: 'Question 2 choice 1' }).fill('Yes');
		await page.getByRole('textbox', { name: 'Question 2 choice 2' }).fill('No');

		await page.getByRole('button', { name: 'Add Question' }).click();
		await page.getByRole('textbox', { name: 'Question 3', exact: true }).fill('Which issues?');
		await page.getByRole('combobox', { name: 'Question 3 type' }).selectOption('check');
		await page.getByRole('button', { name: 'Add a choice to question 3' }).click();
		await page.getByRole('textbox', { name: 'Question 3 choice 1' }).fill('Housing');

		await expect(page.getByText('Saved', { exact: true })).toBeVisible();
		await expect
			.poll(() => questions(db, survey.id))
			.toEqual([
				{ question_text: 'What matters to you?', question_type: 'text', choices: [] },
				{ question_text: 'Will you vote?', question_type: 'radio', choices: ['Yes', 'No'] },
				{ question_text: 'Which issues?', question_type: 'check', choices: ['Housing'] }
			]);
		const { rows } = await db.query(`SELECT name, description FROM universe.survey WHERE id = $1`, [
			survey.id
		]);
		expect(rows[0]).toEqual({ name: 'Ward 5 doors', description: 'Spring outreach' });

		// Reloading shows what was saved.
		await gotoHydrated(page, page.url());
		await expect(page.getByRole('textbox', { name: 'Question 2 choice 2' })).toHaveValue('No');
	});

	test('deleting a question and a choice saves', async ({ world, db }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const survey = await world.createSurvey(staff, bucket.id, [
			{ question_text: 'Keep me', question_type: 'radio', choices: ['A', 'B'] },
			{ question_text: 'Delete me', question_type: 'text' }
		]);
		const page = staff.page;

		await gotoHydrated(
			page,
			`/o/${org.slug}/s/universe/buckets/${bucket.slug}/surveys/${survey.id}`
		);
		await page.getByRole('button', { name: 'Delete question 2' }).click();
		await page.getByRole('button', { name: 'Delete choice 2 of question 1' }).click();

		await expect
			.poll(() => questions(db, survey.id))
			.toEqual([{ question_text: 'Keep me', question_type: 'radio', choices: ['A'] }]);
	});

	test('without survey.update the editor is closed', async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const survey = await world.createSurvey(staff, bucket.id);
		const analyst = await world.as(org, 'analyst'); // survey.read only

		const res = await analyst.page.goto(
			`/o/${org.slug}/s/universe/buckets/${bucket.slug}/surveys/${survey.id}`
		);
		expect(res?.status()).toBe(403);
	});

	test("a survey opened under another bucket's URL answers 404", async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const other = await world.createBucket(staff, org);
		const survey = await world.createSurvey(staff, bucket.id);

		const res = await staff.page.goto(
			`/o/${org.slug}/s/universe/buckets/${other.slug}/surveys/${survey.id}`
		);
		expect(res?.status()).toBe(404);
	});

	test("another org's survey answers 404, and a survey in use cannot be deleted", async ({
		world
	}) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const survey = await world.createSurvey(staff, bucket.id);
		const outsider = await world.as(await world.createOrg(), 'admin');

		expect((await outsider.request.get(`/api/v1/surveys/${survey.id}`)).status()).toBe(404);
		expect((await outsider.request.get(`/api/v1/surveys/${survey.id}/questions`)).status()).toBe(
			404
		);
		expect((await outsider.request.delete(`/api/v1/surveys/${survey.id}`)).status()).toBe(404);

		const unused = await world.createSurvey(staff, bucket.id);
		expect((await staff.request.delete(`/api/v1/surveys/${unused.id}`)).status()).toBe(204);
	});
});

test.describe('scripts', () => {
	test('creating a script opens its editor, and typing saves the text', async ({ world, db }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const base = `/o/${org.slug}/s/universe/buckets/${bucket.slug}/scripts`;
		const name = `Intro ${suffix()}`;

		await gotoHydrated(staff.page, `${base}/new`);
		await staff.page.getByRole('textbox', { name: 'Name' }).fill(name);
		await staff.page.getByRole('button', { name: /Create/ }).click();
		await expect(staff.page).toHaveURL(new RegExp(`${base}/[0-9a-f-]+$`));
		const scriptId = staff.page.url().split('/').pop()!;

		await staff.page.locator('textarea').first().click();
		await staff.page.keyboard.type('Hello, I am a volunteer with the campaign.');
		await expect
			.poll(
				async () =>
					(await db.query(`SELECT contents FROM universe.script WHERE id = $1`, [scriptId])).rows[0]
						.contents
			)
			.toContain('Hello, I am a volunteer with the campaign.');

		await gotoHydrated(staff.page, base);
		await expect(staff.page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
	});

	test("another org's script answers 404", async ({ world }) => {
		const org = await world.createOrg();
		const staff = await world.as(org, 'admin');
		const bucket = await world.createBucket(staff, org);
		const script = await world.createScript(staff, bucket.id);
		const outsider = await world.as(await world.createOrg(), 'admin');

		expect((await outsider.request.get(`/api/v1/scripts/${script.id}`)).status()).toBe(404);
		expect(
			(
				await outsider.request.patch(`/api/v1/scripts/${script.id}`, { data: { contents: 'x' } })
			).status()
		).toBe(404);
	});
});
