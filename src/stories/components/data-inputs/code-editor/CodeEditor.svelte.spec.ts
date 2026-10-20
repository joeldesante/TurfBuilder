import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import CodeEditor from './CodeEditor.svelte';

describe('CodeEditor', () => {
	test('shows the value in an editor named by its label', async () => {
		const { getByRole } = render(CodeEditor, { props: { label: 'Email body', value: '<p>Hello</p>' } });

		await expect.element(getByRole('textbox', { name: 'Email body' })).toHaveTextContent('<p>Hello</p>');
	});

	test('reports what is typed', async () => {
		const onchange = vi.fn();
		const { getByRole } = render(CodeEditor, { props: { label: 'Email body', value: '', onchange } });

		await getByRole('textbox', { name: 'Email body' }).click();
		await userEvent.keyboard('hi');

		await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith('hi'));
	});

	test('takes a new value from outside', async () => {
		const screen = render(CodeEditor, { props: { label: 'Email body', value: 'one' } });
		await expect.element(screen.getByRole('textbox', { name: 'Email body' })).toHaveTextContent('one');

		await screen.rerender({ label: 'Email body', value: 'two' });

		await expect.element(screen.getByRole('textbox', { name: 'Email body' })).toHaveTextContent('two');
	});

	test('does not accept typing when read only', async () => {
		const onchange = vi.fn();
		const { getByRole } = render(CodeEditor, { props: { label: 'Default', value: 'fixed', readonly: true, onchange } });

		await getByRole('textbox', { name: 'Default' }).click();
		await userEvent.keyboard('x');

		expect(onchange).not.toHaveBeenCalled();
	});

	test('inserts text at the cursor', async () => {
		const onchange = vi.fn();
		const screen = render(CodeEditor, { props: { label: 'Email body', value: 'Hi ', onchange } });
		await screen.getByRole('textbox', { name: 'Email body' }).click();
		await userEvent.keyboard('{Control>}{End}{/Control}');

		screen.component.insert('{{username}}');

		await vi.waitFor(() => expect(onchange).toHaveBeenLastCalledWith('Hi {{username}}'));
	});
});
