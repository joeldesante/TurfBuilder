import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import PolygonPickerModal from './PolygonPickerModal.svelte';

const base = { open: true, onOpenChange: () => {}, onapply: () => {} };

const triangle: GeoJSON.Polygon = {
	type: 'Polygon',
	coordinates: [
		[
			[-75.25, 40.0],
			[-75.2, 40.05],
			[-75.15, 40.0],
			[-75.25, 40.0]
		]
	]
};

test('renders nothing while closed', async () => {
	const { getByText } = render(PolygonPickerModal, { props: { ...base, open: false } });

	await expect.element(getByText('Drawn Region')).not.toBeInTheDocument();
});

test('cannot apply until a shape is drawn', async () => {
	const { getByRole } = render(PolygonPickerModal, { props: base });

	await expect.element(getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('applies the existing region', async () => {
	const onapply = vi.fn();
	const { getByRole } = render(PolygonPickerModal, {
		props: { ...base, value: triangle, onapply }
	});

	await getByRole('button', { name: 'Apply' }).click();

	expect(onapply).toHaveBeenCalledWith(triangle);
});

test('cancels without applying', async () => {
	const onapply = vi.fn();
	const onOpenChange = vi.fn();
	const { getByRole } = render(PolygonPickerModal, {
		props: { ...base, value: triangle, onapply, onOpenChange }
	});

	await getByRole('button', { name: 'Cancel' }).click();

	expect(onapply).not.toHaveBeenCalled();
	expect(onOpenChange).toHaveBeenCalledWith(false);
});
