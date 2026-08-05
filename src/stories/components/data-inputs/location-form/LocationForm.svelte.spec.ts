import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import LocationForm from './LocationForm.svelte';

const coordinates = { latitude: 39.9526, longitude: -75.1652 };

const base = {
	coordinates,
	onSubmit: async () => {}
};

test('renders each address part as its own field', async () => {
	const { getByLabelText } = render(LocationForm, { props: base });

	await expect.element(getByLabelText('Business name')).toBeVisible();
	await expect.element(getByLabelText('Street address')).toBeVisible();
	await expect.element(getByLabelText('City')).toBeVisible();
	await expect.element(getByLabelText('State or region')).toBeVisible();
	await expect.element(getByLabelText('Postal code')).toBeVisible();
	await expect.element(getByLabelText('Country')).toBeVisible();
});

test('prefills from initialValues for an edit flow', async () => {
	const { getByLabelText } = render(LocationForm, {
		props: {
			...base,
			initialValues: { name: 'Rosa Deli', city: 'Philadelphia', country_code: 'US' }
		}
	});

	await expect.element(getByLabelText('Business name')).toHaveValue('Rosa Deli');
	await expect.element(getByLabelText('City')).toHaveValue('Philadelphia');
	await expect.element(getByLabelText('Country')).toHaveValue('US');
});

test('shows the pin position', async () => {
	const { getByTestId } = render(LocationForm, { props: base });

	await expect.element(getByTestId('location-form-coordinates')).toHaveTextContent(
		'39.95260, -75.16520'
	);
});

test('submits the typed values with the pin coordinates', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(LocationForm, { props: { ...base, onSubmit } });

	await getByLabelText('Business name').fill('Rosa Deli');
	await getByLabelText('Street address').fill('123 Main St');
	await getByRole('button', { name: 'Add location' }).click();

	await vi.waitFor(() => {
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
	expect(onSubmit.mock.calls[0][0]).toMatchObject({
		name: 'Rosa Deli',
		address_line_1: '123 Main St',
		latitude: 39.9526,
		longitude: -75.1652
	});
});

// The database stores absent address parts as NULL, not empty strings, so the
// form has to convert on the way out.
test('sends blank fields as null rather than empty strings', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(LocationForm, { props: { ...base, onSubmit } });

	await getByLabelText('Business name').fill('Rosa Deli');
	await getByRole('button', { name: 'Add location' }).click();

	await vi.waitFor(() => {
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
	expect(onSubmit.mock.calls[0][0].city).toBeNull();
	expect(onSubmit.mock.calls[0][0].address_line_2).toBeNull();
});

test('uppercases the country code', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(LocationForm, { props: { ...base, onSubmit } });

	await getByLabelText('Country').fill('us');
	await getByRole('button', { name: 'Add location' }).click();

	await vi.waitFor(() => {
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
	expect(onSubmit.mock.calls[0][0].country_code).toBe('US');
});

test('rejects a country code that is not two letters', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole, getByText } = render(LocationForm, {
		props: { ...base, onSubmit }
	});

	await getByLabelText('Country').fill('USA');
	await getByRole('button', { name: 'Add location' }).click();

	await expect.element(getByText('Use a two-letter country code.')).toBeVisible();
	expect(onSubmit).not.toHaveBeenCalled();
});

test('surfaces a rejected submission as an error message', async () => {
	const onSubmit = vi.fn().mockRejectedValue(new Error('Pin must be inside your turf.'));
	const { getByRole } = render(LocationForm, { props: { ...base, onSubmit } });

	await getByRole('button', { name: 'Add location' }).click();

	await expect.element(getByRole('alert')).toHaveTextContent('Pin must be inside your turf.');
});

test('uses the supplied submit label', async () => {
	const { getByRole } = render(LocationForm, {
		props: { ...base, submitLabel: 'Save changes' }
	});

	await expect.element(getByRole('button', { name: 'Save changes' })).toBeVisible();
});

test('shows instructions when supplied', async () => {
	const { getByText } = render(LocationForm, {
		props: { ...base, instructions: 'Photograph the name and address.' }
	});

	await expect.element(getByText('Photograph the name and address.')).toBeVisible();
});

test('omits the cancel button when there is no cancel handler', async () => {
	const { getByRole } = render(LocationForm, { props: base });

	await expect.element(getByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
});

test('calls onCancel when cancelled', async () => {
	const onCancel = vi.fn();
	const { getByRole } = render(LocationForm, { props: { ...base, onCancel } });

	await getByRole('button', { name: 'Cancel' }).click();

	expect(onCancel).toHaveBeenCalledTimes(1);
});

// The map owns the pin, so a drag while the form is open must reach the payload.
test('follows the pin when the parent moves it', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const props = $state({ coordinates: { ...coordinates }, onSubmit });
	const { getByRole, getByTestId } = render(LocationForm, { props });

	props.coordinates = { latitude: 40.1, longitude: -75.9 };

	await expect
		.element(getByTestId('location-form-coordinates'))
		.toHaveTextContent('40.10000, -75.90000');

	await getByRole('button', { name: 'Add location' }).click();

	await vi.waitFor(() => {
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
	expect(onSubmit.mock.calls[0][0]).toMatchObject({ latitude: 40.1, longitude: -75.9 });
});

test('hides the photo uploader unless an org slug is supplied', async () => {
	const { getByRole } = render(LocationForm, { props: base });

	await expect.element(getByRole('button', { name: /Add photo/ })).not.toBeInTheDocument();
});

test('shows the photo uploader when an org slug is supplied', async () => {
	const { getByRole } = render(LocationForm, { props: { ...base, orgSlug: 'acme' } });

	await expect.element(getByRole('button', { name: /Add photo/ })).toBeVisible();
});

test('carries existing photo keys through a submission', async () => {
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	const { getByRole } = render(LocationForm, {
		props: {
			...base,
			orgSlug: 'acme',
			onSubmit,
			initialValues: { photo_keys: ['orgs/o1/locations/a.webp'] }
		}
	});

	await getByRole('button', { name: 'Add location' }).click();

	await vi.waitFor(() => {
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
	expect(onSubmit.mock.calls[0][0].photo_keys).toEqual(['orgs/o1/locations/a.webp']);
});
