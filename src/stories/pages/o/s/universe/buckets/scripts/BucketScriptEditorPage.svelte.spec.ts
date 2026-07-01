import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import BucketScriptEditorPage from './BucketScriptEditorPage.svelte';

const baseProps = {
	scriptName: 'Door Knock Script',
	bucketName: 'Registered Voters',
	initialContent: '',
	onSave: vi.fn()
};

test('renders script name as heading', async () => {
	const { getByRole } = render(BucketScriptEditorPage, { props: baseProps });
	await expect.element(getByRole('heading', { name: 'Door Knock Script' })).toBeVisible();
});

test('renders Save button', async () => {
	const { getByRole } = render(BucketScriptEditorPage, { props: baseProps });
	await expect.element(getByRole('button', { name: 'Save' })).toBeVisible();
});
