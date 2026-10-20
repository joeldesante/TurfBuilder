import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraEmailTemplateEditorPage from './InfraEmailTemplateEditorPage.svelte';
import { templateDetail } from './fixtures';

function props(overrides: Record<string, unknown> = {}) {
	return {
		template: templateDetail,
		onsave: vi.fn(async () => {}),
		ontest: vi.fn(async () => 'Sent a test email to you@example.com.'),
		onreset: vi.fn(async () => {}),
		...overrides
	};
}

describe('InfraEmailTemplateEditorPage', () => {
	test('previews the email filled with sample values', async () => {
		const { getByText, container } = render(InfraEmailTemplateEditorPage, { props: props() });

		await expect.element(getByText('Subject: Choose a new password')).toBeVisible();
		const frame = container.querySelector('iframe')!;
		expect(frame.srcdoc).toContain('Hi Ada');
		expect(frame.srcdoc).toContain('https://example.com/reset?token=sample');
		expect(frame.getAttribute('sandbox')).toBe('');
	});

	test('saves the edited subject', async () => {
		const p = props();
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: p });

		await expect.element(getByRole('button', { name: 'Save' })).toBeDisabled();
		await getByRole('textbox', { name: 'Subject' }).fill('A new subject');
		await getByRole('button', { name: 'Save' }).click();

		expect(p.onsave).toHaveBeenCalledWith({ subject: 'A new subject', htmlBody: templateDetail.htmlBody });
		await expect.element(getByRole('status')).toHaveTextContent('Saved.');
	});

	test('warns about variables the email does not provide', async () => {
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: props() });

		await getByRole('textbox', { name: 'Subject' }).fill('Hello {{nickname}}');

		await expect.element(getByRole('status')).toHaveTextContent('{{nickname}} is not provided');
	});

	test('sends the text being edited as a test', async () => {
		const p = props();
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: p });

		await getByRole('textbox', { name: 'Subject' }).fill('Trying this');
		await getByRole('button', { name: 'Send test to me' }).click();

		expect(p.ontest).toHaveBeenCalledWith({ subject: 'Trying this', htmlBody: templateDetail.htmlBody });
		await expect.element(getByRole('status')).toHaveTextContent('Sent a test email to you@example.com.');
	});

	test('shows a failed save as an alert', async () => {
		const p = props({ onsave: vi.fn(async () => { throw new Error('The subject cannot be empty.'); }) });
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: p });

		await getByRole('textbox', { name: 'Subject' }).fill('x');
		await getByRole('button', { name: 'Save' }).click();

		await expect.element(getByRole('alert')).toHaveTextContent('The subject cannot be empty.');
	});

	test('resets only after confirming, and only when edited', async () => {
		const p = props();
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: p });

		await getByRole('button', { name: 'Reset to default' }).click();
		expect(p.onreset).not.toHaveBeenCalled();
		await getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
		expect(p.onreset).toHaveBeenCalled();
	});

	test('has no reset for a template still on its default text', async () => {
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: props({ template: { ...templateDetail, customized: false } }) });

		await expect.element(getByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
	});

	test('puts a variable in the body at the cursor', async () => {
		const { getByRole } = render(InfraEmailTemplateEditorPage, { props: props() });
		const editor = getByRole('textbox', { name: 'Email body HTML' });

		await editor.click();
		await getByRole('button', { name: '{{username}}' }).click();

		// The body already has one; the button added a second.
		await expect.element(editor).toHaveTextContent(/\{\{username\}\}[\s\S]*\{\{username\}\}/);
	});
});
