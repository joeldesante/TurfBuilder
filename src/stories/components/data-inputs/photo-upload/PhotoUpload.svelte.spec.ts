import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import PhotoUpload from './PhotoUpload.svelte';

const base = { orgSlug: 'acme' };

/** A 1x1 PNG, enough for createImageBitmap to work on in a real browser. */
function makeFile(name = 'shopfront.png'): File {
	const bytes = Uint8Array.from(
		atob(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
		),
		(c) => c.charCodeAt(0)
	);
	return new File([bytes], name, { type: 'image/png' });
}

/** Drives the hidden file input the way a file picker would. */
async function selectFiles(container: HTMLElement, files: File[]) {
	const input = container.querySelector<HTMLInputElement>('[data-testid="photo-upload-input"]')!;
	const transfer = new DataTransfer();
	for (const file of files) transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		if (String(url).includes('/uploads/presign')) {
			return {
				ok: true,
				json: async () => ({ url: 'https://signed.example/put', key: `key-${Math.random()}` })
			};
		}
		return { ok: true, json: async () => ({}) };
	});
	vi.stubGlobal('fetch', fetchMock);
});

test('shows how many photos have been added', async () => {
	const { getByText } = render(PhotoUpload, { props: base });

	await expect.element(getByText('0 of 3 added')).toBeVisible();
});

test('renders a thumbnail per key, served through the org read route', async () => {
	const { getByAltText } = render(PhotoUpload, {
		props: { ...base, keys: ['orgs/o1/locations/a.webp'] }
	});

	await expect
		.element(getByAltText('Uploaded photo of the business'))
		.toHaveAttribute('src', '/o/acme/uploads/orgs/o1/locations/a.webp');
});

test('instructs the volunteer what to photograph', async () => {
	const { getByText } = render(PhotoUpload, { props: base });

	await expect.element(getByText(/Photograph the business name and address/)).toBeVisible();
});

test('disables adding once the cap is reached', async () => {
	const { getByRole } = render(PhotoUpload, {
		props: { ...base, keys: ['a', 'b', 'c'] }
	});

	await expect.element(getByRole('button', { name: /Add photo/ })).toBeDisabled();
});

test('removes a photo', async () => {
	const props = $state({ ...base, keys: ['orgs/o1/locations/a.webp'] });
	const { getByRole } = render(PhotoUpload, { props });

	await getByRole('button', { name: 'Remove photo' }).click();

	expect(props.keys).toEqual([]);
});

test('compresses, uploads, and records the returned key', async () => {
	const props = $state({ ...base, keys: [] as string[] });
	const { container } = render(PhotoUpload, { props });

	await selectFiles(container, [makeFile()]);

	await vi.waitFor(() => {
		expect(props.keys).toHaveLength(1);
	});

	const presignCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/uploads/presign'))!;
	const body = JSON.parse((presignCall[1] as RequestInit).body as string);
	// Re-encoded to webp on the client, whatever the camera produced.
	expect(body.contentType).toBe('image/webp');
	expect(body.contentLength).toBeGreaterThan(0);
});

test('PUTs the compressed blob to the signed url', async () => {
	const props = $state({ ...base, keys: [] as string[] });
	const { container } = render(PhotoUpload, { props });

	await selectFiles(container, [makeFile()]);

	await vi.waitFor(() => {
		expect(props.keys).toHaveLength(1);
	});

	const putCall = fetchMock.mock.calls.find((c) => c[0] === 'https://signed.example/put')!;
	expect((putCall[1] as RequestInit).method).toBe('PUT');
});

test('never accepts more than the cap in one selection', async () => {
	const props = $state({ ...base, keys: [] as string[] });
	const { container } = render(PhotoUpload, { props });

	await selectFiles(container, [makeFile('a.png'), makeFile('b.png'), makeFile('c.png'), makeFile('d.png')]);

	await vi.waitFor(() => {
		expect(props.keys).toHaveLength(3);
	});
});

test('surfaces a presign failure', async () => {
	fetchMock.mockImplementation(async (url: string) => {
		if (String(url).includes('/uploads/presign')) {
			return { ok: false, json: async () => ({ error: 'Object storage is not configured.' }) };
		}
		return { ok: true, json: async () => ({}) };
	});
	const { container, getByRole } = render(PhotoUpload, { props: { ...base, keys: [] } });

	await selectFiles(container, [makeFile()]);

	await expect.element(getByRole('alert')).toHaveTextContent('Object storage is not configured.');
});

test('surfaces a failed upload', async () => {
	fetchMock.mockImplementation(async (url: string) => {
		if (String(url).includes('/uploads/presign')) {
			return { ok: true, json: async () => ({ url: 'https://signed.example/put', key: 'k' }) };
		}
		return { ok: false, json: async () => ({}) };
	});
	const { container, getByRole } = render(PhotoUpload, { props: { ...base, keys: [] } });

	await selectFiles(container, [makeFile()]);

	await expect.element(getByRole('alert')).toHaveTextContent(/Upload failed/);
});
