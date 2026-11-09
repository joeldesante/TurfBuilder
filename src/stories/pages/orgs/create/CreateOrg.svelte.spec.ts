import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CreateOrg from './CreateOrg.svelte';

const description = 'We knock doors for tenant rights in West Philly.';

function continueButton() {
	return page.getByRole('button', { name: 'Continue' });
}

/** Answers the type and description steps, leaving the form on the name and slug step. */
async function reachNameStep(category = 'Non-profit') {
	await page.getByRole('radio', { name: category, exact: true }).click();
	await continueButton().click();
	await page.getByLabelText('Description').fill(description);
	await continueButton().click();
	await expect.element(page.getByLabelText('Name')).toBeVisible();
}

describe('CreateOrg', () => {
	it('renders the heading', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Create Organization');
	});

	it('has a back button that returns to the organization page', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		const back = page.getByRole('link', { name: 'Back' });
		await expect.element(back).toBeVisible();
		expect(back.element().getAttribute('href')).toBe('/orgs');
	});

	it('pins the back button to the top left corner', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		const corner = page.getByRole('link', { name: 'Back' }).element().parentElement!;
		expect(corner.classList.contains('absolute')).toBe(true);
		expect(corner.classList.contains('top-4')).toBe(true);
		expect(corner.classList.contains('left-4')).toBe(true);
	});

	describe('steps', () => {
		it('starts on the organization type step with nothing chosen', async () => {
			render(CreateOrg, { onCreate: vi.fn() });

			await expect.element(page.getByText('Step 1 of 3')).toBeVisible();
			await expect
				.element(page.getByRole('heading', { level: 2 }))
				.toHaveTextContent('What kind of organization is this?');
			for (const name of ['Political or civic', 'Non-profit', 'Business']) {
				await expect.element(page.getByRole('radio', { name, exact: true })).not.toBeChecked();
			}
			await expect.element(page.getByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
		});

		it('explains each organization type', async () => {
			render(CreateOrg, { onCreate: vi.fn() });

			await expect
				.element(page.getByRole('radio', { name: 'Business', exact: true }))
				.toHaveAccessibleDescription(
					'Companies canvassing for sales, customer outreach, or market research.'
				);
		});

		it('asks for a type before moving on', async () => {
			render(CreateOrg, { onCreate: vi.fn() });

			await continueButton().click();

			await expect.element(page.getByText('Choose the kind of organization')).toBeVisible();
			await expect.element(page.getByText('Step 1 of 3')).toBeVisible();
		});

		it('asks for a description before moving on', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await page.getByRole('radio', { name: 'Business', exact: true }).click();
			await continueButton().click();

			await continueButton().click();

			await expect.element(page.getByText('Tell us what your organization does')).toBeVisible();
			await expect.element(page.getByText('Step 2 of 3')).toBeVisible();
		});

		it('does not flag fields on later steps while on an earlier one', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await page.getByRole('radio', { name: 'Business', exact: true }).click();
			await continueButton().click();

			await expect.element(page.getByText('Step 2 of 3')).toBeVisible();
			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('keeps answers when going back a step', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep('Business');

			await page.getByRole('button', { name: 'Previous' }).click();
			await expect.element(page.getByLabelText('Description')).toHaveValue(description);
			await page.getByRole('button', { name: 'Previous' }).click();

			await expect
				.element(page.getByRole('radio', { name: 'Business', exact: true }))
				.toBeChecked();
		});

		it('moves focus to the new step heading', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await page.getByRole('radio', { name: 'Business', exact: true }).click();
			await continueButton().click();

			await expect
				.element(page.getByRole('heading', { level: 2 }))
				.toHaveTextContent('What does your organization do?');
			await expect.element(page.getByRole('heading', { level: 2 })).toHaveFocus();
		});
	});

	describe('candidates', () => {
		it('only asks about running for office for political organizations', async () => {
			render(CreateOrg, { onCreate: vi.fn() });

			await page.getByRole('radio', { name: 'Non-profit', exact: true }).click();
			await expect.element(page.getByRole('checkbox')).not.toBeInTheDocument();

			await page.getByRole('radio', { name: 'Political or civic', exact: true }).click();
			await expect.element(page.getByRole('checkbox')).toBeVisible();
			await expect.element(page.getByLabelText('Campaign registration')).not.toBeInTheDocument();
		});

		it('asks a candidate for their campaign registration before moving on', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await page.getByRole('radio', { name: 'Political or civic', exact: true }).click();
			await page.getByRole('checkbox').click();

			await continueButton().click();

			await expect
				.element(page.getByText('Enter your FEC ID or a link to your campaign registration'))
				.toBeVisible();
			await expect.element(page.getByText('Step 1 of 3')).toBeVisible();
		});

		it('submits the registration for a candidate', async () => {
			const onCreate = vi.fn().mockResolvedValue(undefined);
			render(CreateOrg, { onCreate });
			await page.getByRole('radio', { name: 'Political or civic', exact: true }).click();
			await page.getByRole('checkbox').click();
			await page.getByLabelText('Campaign registration').fill('C00123456');
			await continueButton().click();
			await page.getByLabelText('Description').fill(description);
			await continueButton().click();

			await page.getByLabelText('Name').fill('Smith for Council');
			await page.getByRole('button', { name: 'Create Organization' }).click();

			expect(onCreate).toHaveBeenCalledWith({
				name: 'Smith for Council',
				slug: 'smith-for-council',
				category: 'political',
				description,
				is_candidate: true,
				campaign_registration: 'C00123456'
			});
		});

		it('lets a political organization that is not a candidate continue without one', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await page.getByRole('radio', { name: 'Political or civic', exact: true }).click();

			await continueButton().click();

			await expect.element(page.getByText('Step 2 of 3')).toBeVisible();
		});
	});

	describe('name and slug', () => {
		it('renders name and slug inputs', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep();
			await expect.element(page.getByLabelText('Name')).toBeVisible();
			await expect.element(page.getByLabelText('Slug')).toBeVisible();
		});

		it('auto-derives slug from name input', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep();
			await page.getByLabelText('Name').fill('North West Philly Alliance');
			await expect.element(page.getByLabelText('Slug')).toHaveValue('north-west-philly-alliance');
		});

		it('calls onCreate with every answer on submit', async () => {
			const onCreate = vi.fn().mockResolvedValue(undefined);
			render(CreateOrg, { onCreate });
			await reachNameStep();
			await page.getByLabelText('Name').fill('Test Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();
			expect(onCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Test Org',
					slug: 'test-org',
					category: 'nonprofit',
					description,
					is_candidate: false
				})
			);
		});

		it('shows error message when onCreate rejects', async () => {
			const onCreate = vi.fn().mockRejectedValue(new Error('That slug is already taken.'));
			render(CreateOrg, { onCreate });
			await reachNameStep();
			await page.getByLabelText('Name').fill('Test Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();
			await expect
				.element(page.getByRole('alert'))
				.toHaveTextContent('That slug is already taken.');
		});

		it('does not show error message initially', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			// The alert is only rendered once there is an error.
			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('shows generic placeholders instead of an example organization', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep();
			await expect.element(page.getByPlaceholder("Your Organization's Name")).toBeVisible();
			await expect.element(page.getByPlaceholder('your-organizations-name')).toBeVisible();
		});

		it('asks for a name when the form is submitted empty', async () => {
			const onCreate = vi.fn();
			render(CreateOrg, { onCreate });
			await reachNameStep();

			await page.getByRole('button', { name: 'Create Organization' }).click();

			await expect.element(page.getByText('Enter a name')).toBeVisible();
			expect(onCreate).not.toHaveBeenCalled();
		});

		it('explains a badly formed slug once the field is left', async () => {
			render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep();

			await page.getByLabelText('Slug').fill('Not A Slug');
			await page.getByLabelText('Name').click();

			await expect
				.element(page.getByText('Slug must be lowercase letters, numbers, and hyphens'))
				.toBeVisible();
		});
	});

	describe('slug availability', () => {
		const taken = 'That slug is already taken.';

		async function renderWithCheck(
			checkSlug: (slug: string) => Promise<boolean>,
			onCreate = vi.fn()
		) {
			const screen = render(CreateOrg, { onCreate, checkSlug, slugCheckDelayMs: 0 });
			await reachNameStep();
			return { onCreate, screen };
		}

		it('flags a taken slug as soon as it is typed, without leaving the field', async () => {
			const checkSlug = vi.fn().mockResolvedValue(false);
			await renderWithCheck(checkSlug);

			await page.getByLabelText('Name').fill('Taken Org');

			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			expect(checkSlug).toHaveBeenCalledWith('taken-org');
			await expect.element(page.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
		});

		it('does not flag a slug that is free', async () => {
			await renderWithCheck(vi.fn().mockResolvedValue(true));

			await page.getByLabelText('Name').fill('Free Org');

			await expect.element(page.getByText('Used in URLs: /o/free-org/')).toBeVisible();
			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('checks a slug the user typed in the slug field itself', async () => {
			const checkSlug = vi.fn().mockResolvedValue(false);
			await renderWithCheck(checkSlug);

			await page.getByLabelText('Slug').fill('my-own-slug');

			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			expect(checkSlug).toHaveBeenCalledWith('my-own-slug');
		});

		it('does not ask the server about a slug that is not well formed', async () => {
			const checkSlug = vi.fn().mockResolvedValue(true);
			await renderWithCheck(checkSlug);

			await page.getByLabelText('Slug').fill('Not A Slug');
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(checkSlug).not.toHaveBeenCalled();
		});

		it('clears the error when the slug changes to a free one', async () => {
			const checkSlug = vi.fn(async (slug: string) => slug !== 'taken-org');
			await renderWithCheck(checkSlug);

			await page.getByLabelText('Name').fill('Taken Org');
			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);

			await page.getByLabelText('Slug').fill('taken-org-2');

			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('shows a spinner in the slug field while it waits, and leaves the helper text alone', async () => {
			const { screen } = await renderWithCheck(() => new Promise<boolean>(() => {}));

			await page.getByLabelText('Name').fill('Slow Org');

			await expect.element(page.getByRole('status')).toHaveTextContent('Checking availability');
			expect(screen.container.querySelector('svg.animate-spin')).toBeTruthy();
			await expect.element(page.getByText('Used in URLs: /o/slow-org/')).toBeVisible();
			await expect.element(page.getByText('Checking availability…')).not.toBeInTheDocument();
		});

		it('removes the spinner once the check finishes', async () => {
			const { screen } = await renderWithCheck(vi.fn().mockResolvedValue(true));

			await page.getByLabelText('Name').fill('Fast Org');

			await expect.poll(() => screen.container.querySelector('svg.animate-spin')).toBeNull();
			await expect.element(page.getByText('Used in URLs: /o/fast-org/')).toBeVisible();
		});

		it('shows no spinner when no check is wired up', async () => {
			const { container } = render(CreateOrg, { onCreate: vi.fn() });
			await reachNameStep();

			await page.getByLabelText('Name').fill('Some Org');

			expect(container.querySelector('svg.animate-spin')).toBeNull();
		});

		it('blocks submit while the slug is taken', async () => {
			const { onCreate } = await renderWithCheck(vi.fn().mockResolvedValue(false));

			await page.getByLabelText('Name').fill('Taken Org');
			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			await page.getByRole('button', { name: 'Create Organization' }).click();

			expect(onCreate).not.toHaveBeenCalled();
		});

		it('still submits when the check itself fails', async () => {
			const { onCreate } = await renderWithCheck(vi.fn().mockRejectedValue(new Error('offline')));

			await page.getByLabelText('Name').fill('Some Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();

			expect(onCreate).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'Some Org', slug: 'some-org' })
			);
		});

		it('shows the server message when submitting loses a race for the slug', async () => {
			const onCreate = vi
				.fn()
				.mockRejectedValue(new Error('An organization with that slug already exists'));
			await renderWithCheck(vi.fn().mockResolvedValue(true), onCreate);

			await page.getByLabelText('Name').fill('Race Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();

			await expect
				.element(page.getByRole('alert'))
				.toHaveTextContent('An organization with that slug already exists');
		});
	});
});
