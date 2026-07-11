import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import SetupWizardPage from './SetupWizardPage.svelte';

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
	vi.stubGlobal(
		'fetch',
		vi.fn((url: RequestInfo | URL, init?: RequestInit) => handler(String(url), init))
	);
}

const SCHEMA_SSE =
	'data: {"step":1,"total":1,"label":"Create tables","status":"done"}\ndata: {"done":true}\n';

test('renders the database connection step first', async () => {
	const { getByRole } = render(SetupWizardPage);
	await expect.element(getByRole('heading', { name: 'Database Connection' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Test Connection' })).toBeVisible();
	await expect.element(getByRole('button', { name: /Continue/ })).toBeDisabled();
});

test('successful DB check enables Continue and advances to schema setup', async () => {
	mockFetch(() => new Response(JSON.stringify({ ok: true })));
	const { getByRole, getByText } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await expect.element(getByText('Connected successfully.')).toBeVisible();
	await getByRole('button', { name: /Continue/ }).click();
	await expect.element(getByRole('heading', { name: 'Initialize Database' })).toBeVisible();
});

test('failed DB check routes to the help screen with the error', async () => {
	mockFetch(() => new Response(JSON.stringify({ ok: false, error: 'ECONNREFUSED 127.0.0.1:5432' })));
	const { getByRole, getByText } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await expect.element(getByRole('heading', { name: 'Database Connection Help' })).toBeVisible();
	await expect.element(getByText('ECONNREFUSED 127.0.0.1:5432')).toBeVisible();
});

test('help screen retry returns to the connection check', async () => {
	mockFetch(() => new Response(JSON.stringify({ ok: false, error: 'boom' })));
	const { getByRole } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await getByRole('button', { name: 'Try Again' }).click();
	await expect.element(getByRole('heading', { name: 'Database Connection' })).toBeVisible();
});

test('schema setup completion advances to the base URLs step', async () => {
	mockFetch((url) => {
		if (url.includes('check-db')) return new Response(JSON.stringify({ ok: true }));
		if (url.includes('create-schema')) return new Response(SCHEMA_SSE);
		return new Response(JSON.stringify({ ok: true }));
	});
	const { getByRole } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await getByRole('button', { name: /Continue/ }).click();
	await getByRole('button', { name: 'Initialize Database' }).click();
	await getByRole('button', { name: /Continue/ }).click();
	await expect.element(getByRole('heading', { name: 'Base URLs' })).toBeVisible();
});

test('base URLs step supports adding hosts and advances to email mode', async () => {
	mockFetch((url) => {
		if (url.includes('check-db')) return new Response(JSON.stringify({ ok: true }));
		if (url.includes('create-schema')) return new Response(SCHEMA_SSE);
		return new Response(JSON.stringify({ ok: true }));
	});
	const { getByRole, getByLabelText } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await getByRole('button', { name: /Continue/ }).click();
	await getByRole('button', { name: 'Initialize Database' }).click();
	await getByRole('button', { name: /Continue/ }).click();

	await getByRole('button', { name: '+ Add another host' }).click();
	await expect.element(getByLabelText('Host 2', { exact: true })).toBeVisible();
	await getByLabelText('Host 1', { exact: true }).fill('https://app.example.com');
	await getByLabelText('Host 2', { exact: true }).fill('https://alt.example.com');
	await getByRole('button', { name: /Save & Continue/ }).click();
	await expect.element(getByRole('heading', { name: 'Email Delivery' })).toBeVisible();
});

test('direct send shows a warning before it can be selected', async () => {
	mockFetch((url) => {
		if (url.includes('check-db')) return new Response(JSON.stringify({ ok: true }));
		if (url.includes('create-schema')) return new Response(SCHEMA_SSE);
		return new Response(JSON.stringify({ ok: true }));
	});
	const { getByRole, getByText, getByLabelText } = render(SetupWizardPage);
	await getByRole('button', { name: 'Test Connection' }).click();
	await getByRole('button', { name: /Continue/ }).click();
	await getByRole('button', { name: 'Initialize Database' }).click();
	await getByRole('button', { name: /Continue/ }).click();
	await getByLabelText('Host 1').fill('https://app.example.com');
	await getByRole('button', { name: /Save & Continue/ }).click();

	await getByRole('button', { name: /Direct Send from Machine/ }).click();
	await expect
		.element(getByText(/Many email providers block mail sent directly/))
		.toBeVisible();
	await getByRole('button', { name: 'Use Direct Send Anyway' }).click();
	await expect.element(getByRole('heading', { name: 'Configure Direct Send' })).toBeVisible();
});
