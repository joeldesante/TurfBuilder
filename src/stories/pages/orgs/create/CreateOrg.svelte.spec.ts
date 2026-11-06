import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CreateOrg from './CreateOrg.svelte';

describe('CreateOrg', () => {
	it('renders the heading', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Create Organization');
	});

	it('renders name and slug inputs', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect.element(page.getByLabelText('Name')).toBeVisible();
		await expect.element(page.getByLabelText('Slug')).toBeVisible();
	});

	it('auto-derives slug from name input', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await page.getByLabelText('Name').fill('North West Philly Alliance');
		const slugInput = page.getByLabelText('Slug');
		await expect.element(slugInput).toHaveValue('north-west-philly-alliance');
	});

	it('calls onCreate with name and slug on submit', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(CreateOrg, { onCreate });
		await page.getByLabelText('Name').fill('Test Org');
		await page.getByRole('button', { name: 'Create Organization' }).click();
		expect(onCreate).toHaveBeenCalledWith('Test Org', 'test-org');
	});

	it('shows error message when onCreate rejects', async () => {
		const onCreate = vi.fn().mockRejectedValue(new Error('That slug is already taken.'));
		render(CreateOrg, { onCreate });
		await page.getByLabelText('Name').fill('Test Org');
		await page.getByRole('button', { name: 'Create Organization' }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent('That slug is already taken.');
	});

	it('does not show error message initially', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		// The alert is only rendered once there is an error.
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
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

	it('shows generic placeholders instead of an example organization', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect.element(page.getByPlaceholder("Your Organization's Name")).toBeVisible();
		await expect.element(page.getByPlaceholder('your-organizations-name')).toBeVisible();
	});

	describe('slug availability', () => {
		const taken = 'That slug is already taken.';

		function renderWithCheck(checkSlug: (slug: string) => Promise<boolean>, onCreate = vi.fn()) {
			render(CreateOrg, { onCreate, checkSlug, slugCheckDelayMs: 0 });
			return onCreate;
		}

		it('flags a taken slug as soon as it is typed, without leaving the field', async () => {
			const checkSlug = vi.fn().mockResolvedValue(false);
			renderWithCheck(checkSlug);

			await page.getByLabelText('Name').fill('Taken Org');

			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			expect(checkSlug).toHaveBeenCalledWith('taken-org');
			await expect.element(page.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
		});

		it('does not flag a slug that is free', async () => {
			renderWithCheck(vi.fn().mockResolvedValue(true));

			await page.getByLabelText('Name').fill('Free Org');

			await expect.element(page.getByText('Used in URLs: /o/free-org/')).toBeVisible();
			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('checks a slug the user typed in the slug field itself', async () => {
			const checkSlug = vi.fn().mockResolvedValue(false);
			renderWithCheck(checkSlug);

			await page.getByLabelText('Slug').fill('my-own-slug');

			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			expect(checkSlug).toHaveBeenCalledWith('my-own-slug');
		});

		it('does not ask the server about a slug that is not well formed', async () => {
			const checkSlug = vi.fn().mockResolvedValue(true);
			renderWithCheck(checkSlug);

			await page.getByLabelText('Slug').fill('Not A Slug');
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(checkSlug).not.toHaveBeenCalled();
		});

		it('clears the error when the slug changes to a free one', async () => {
			const checkSlug = vi.fn(async (slug: string) => slug !== 'taken-org');
			renderWithCheck(checkSlug);

			await page.getByLabelText('Name').fill('Taken Org');
			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);

			await page.getByLabelText('Slug').fill('taken-org-2');

			await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		});

		it('shows a spinner in the slug field while it waits, and leaves the helper text alone', async () => {
			const { container } = render(CreateOrg, {
				onCreate: vi.fn(),
				checkSlug: () => new Promise<boolean>(() => {}),
				slugCheckDelayMs: 0
			});

			await page.getByLabelText('Name').fill('Slow Org');

			await expect.element(page.getByRole('status')).toHaveTextContent('Checking availability');
			expect(container.querySelector('svg.animate-spin')).toBeTruthy();
			await expect.element(page.getByText('Used in URLs: /o/slow-org/')).toBeVisible();
			await expect.element(page.getByText('Checking availability…')).not.toBeInTheDocument();
		});

		it('removes the spinner once the check finishes', async () => {
			const { container } = render(CreateOrg, {
				onCreate: vi.fn(),
				checkSlug: vi.fn().mockResolvedValue(true),
				slugCheckDelayMs: 0
			});

			await page.getByLabelText('Name').fill('Fast Org');

			await expect.poll(() => container.querySelector('svg.animate-spin')).toBeNull();
			await expect.element(page.getByText('Used in URLs: /o/fast-org/')).toBeVisible();
		});

		it('shows no spinner when no check is wired up', async () => {
			const { container } = render(CreateOrg, { onCreate: vi.fn() });

			await page.getByLabelText('Name').fill('Some Org');

			expect(container.querySelector('svg.animate-spin')).toBeNull();
		});

		it('blocks submit while the slug is taken', async () => {
			const onCreate = renderWithCheck(vi.fn().mockResolvedValue(false));

			await page.getByLabelText('Name').fill('Taken Org');
			await expect.element(page.getByRole('alert')).toHaveTextContent(taken);
			await page.getByRole('button', { name: 'Create Organization' }).click();

			expect(onCreate).not.toHaveBeenCalled();
		});

		it('still submits when the check itself fails', async () => {
			const onCreate = renderWithCheck(vi.fn().mockRejectedValue(new Error('offline')));

			await page.getByLabelText('Name').fill('Some Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();

			expect(onCreate).toHaveBeenCalledWith('Some Org', 'some-org');
		});

		it('shows the server message when submitting loses a race for the slug', async () => {
			const onCreate = vi
				.fn()
				.mockRejectedValue(new Error('An organization with that slug already exists'));
			renderWithCheck(vi.fn().mockResolvedValue(true), onCreate);

			await page.getByLabelText('Name').fill('Race Org');
			await page.getByRole('button', { name: 'Create Organization' }).click();

			await expect
				.element(page.getByRole('alert'))
				.toHaveTextContent('An organization with that slug already exists');
		});
	});

	describe('validation', () => {
		it('asks for a name when the form is submitted empty', async () => {
			const onCreate = vi.fn();
			render(CreateOrg, { onCreate });

			await page.getByRole('button', { name: 'Create Organization' }).click();

			await expect.element(page.getByText('Enter a name')).toBeVisible();
			expect(onCreate).not.toHaveBeenCalled();
		});

		it('explains a badly formed slug once the field is left', async () => {
			render(CreateOrg, { onCreate: vi.fn() });

			await page.getByLabelText('Slug').fill('Not A Slug');
			await page.getByLabelText('Name').click();

			await expect
				.element(page.getByText('Slug must be lowercase letters, numbers, and hyphens'))
				.toBeVisible();
		});
	});
});
