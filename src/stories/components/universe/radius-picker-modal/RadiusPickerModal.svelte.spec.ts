import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import RadiusPickerModal from './RadiusPickerModal.svelte';

const base = { open: true, onOpenChange: () => {}, onapply: () => {} };

test('renders nothing while closed', async () => {
	const { getByText } = render(RadiusPickerModal, { props: { ...base, open: false } });

	await expect.element(getByText('Radius From Point')).not.toBeInTheDocument();
});

test('cannot apply until a point is chosen', async () => {
	const { getByRole } = render(RadiusPickerModal, { props: base });

	await expect.element(getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('applies the existing area unchanged', async () => {
	const onapply = vi.fn();
	const value = { latitude: 40.0259, longitude: -75.2238, radius: 2 };
	const { getByRole } = render(RadiusPickerModal, { props: { ...base, value, onapply } });

	await getByRole('button', { name: 'Apply' }).click();

	expect(onapply).toHaveBeenCalledWith(value);
});

test('uses the edited radius', async () => {
	const onapply = vi.fn();
	const value = { latitude: 40.0259, longitude: -75.2238, radius: 2 };
	const { getByRole } = render(RadiusPickerModal, { props: { ...base, value, onapply } });

	await getByRole('spinbutton', { name: 'Radius in miles' }).fill('7');
	await getByRole('button', { name: 'Apply' }).click();

	expect(onapply).toHaveBeenCalledWith({ ...value, radius: 7 });
});

test('blocks applying a radius that is not positive', async () => {
	const value = { latitude: 40.0259, longitude: -75.2238, radius: 2 };
	const { getByRole } = render(RadiusPickerModal, { props: { ...base, value } });

	await getByRole('spinbutton', { name: 'Radius in miles' }).fill('0');

	await expect.element(getByRole('button', { name: 'Apply' })).toBeDisabled();
});
