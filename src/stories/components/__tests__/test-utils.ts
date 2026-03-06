import { createRawSnippet } from 'svelte';

/**
 * Creates a formField context map suitable for passing to render().
 * Mimics what FormField.svelte's setContext('formField', ...) provides.
 */
export function createFormFieldContext(
	overrides: {
		id?: string;
		invalid?: boolean;
		disabled?: boolean;
		describedBy?: string | undefined;
	} = {}
) {
	const ctx = {
		id: overrides.id ?? 'test-field',
		invalid: overrides.invalid ?? false,
		disabled: overrides.disabled ?? false,
		describedBy: overrides.describedBy ?? undefined
	};

	return new Map<string, unknown>([['formField', ctx]]);
}

/**
 * Creates an inputGroup context map.
 */
export function createInputGroupContext() {
	return new Map<string, unknown>([['inputGroup', true]]);
}

/**
 * Creates a raw snippet that renders the given text as HTML.
 * Use for components that require a `children` snippet prop (Button, Checkbox, Switch).
 */
export function createChildrenSnippet(text: string) {
	return createRawSnippet(() => ({
		render: () => `<span>${text}</span>`
	}));
}
