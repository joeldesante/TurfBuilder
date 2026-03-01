# Component Testing Guide

This document explains how to write unit tests for TurfBuilder's UI components and what to watch for when components change.

## Overview

We test components with **Vitest** running in a **real Chromium browser** via Playwright (`vitest-browser-svelte`), not JSDOM. This means tests execute against real DOM APIs, real CSS, and real accessibility trees — the same environment users see.

Tests live **next to their component** and are named `ComponentName.svelte.spec.ts`. The `.svelte.spec.ts` suffix is what routes them to the browser test runner (the `client` project in `vite.config.ts`). Plain `.spec.ts` files run in Node instead.

## When to Write Tests

Write a `.svelte.spec.ts` file for every component in `src/stories/components/`. At minimum, each spec should cover:

1. **Rendering** — the component mounts and its primary element is visible
2. **Props** — key props change what renders (variants, sizes, placeholder, disabled)
3. **Accessibility** — ARIA attributes are correct (`aria-invalid`, `aria-describedby`, `role`)
4. **Context integration** — if the component reads from `FormField` or `InputGroup` context, test that it responds to context values
5. **Interaction** — for stateful components (Checkbox, Switch, RadioGroup), test that clicking changes state

You do _not_ need to test Tailwind classes exhaustively.

## File Structure

```
src/stories/components/
  __tests__/                        # Shared fixtures and utilities
    test-utils.ts                   # createFormFieldContext, createChildrenSnippet, etc.
    FormFieldTextInput.svelte       # Fixture: FormField wrapping a TextInput
    FormFieldCheckbox.svelte        # Fixture: FormField wrapping a Checkbox
    InputGroupTextInput.svelte      # Fixture: InputGroup wrapping a TextInput
    InputGroupWithSlots.svelte      # Fixture: InputGroup with leading/trailing slots
  actions/
    button/
      Button.svelte
      Button.svelte.spec.ts         # Tests live next to the component
  data-inputs/
    text-input/
      TextInput.svelte
      TextInput.svelte.spec.ts
    ...
```

## Writing a Test

### Basic structure

```ts
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
	it('renders the primary element', async () => {
		const screen = render(MyComponent, { someProp: 'value' });

		const element = screen.getByRole('button');
		await expect.element(element).toBeVisible();
	});
});
```

### Passing props

Pass props as the second argument to `render()`:

```ts
render(TextInput, { placeholder: 'Enter name', type: 'email' });
```

When you also need to inject **Svelte context** (to simulate being inside a FormField or InputGroup), use the `{ props, context }` form:

```ts
import { createFormFieldContext } from '../../__tests__/test-utils';

render(TextInput, {
	props: { placeholder: 'Enter name' },
	context: createFormFieldContext({ invalid: true, disabled: false })
});
```

**Convention:** Use bare props when there's no context. Use `{ props, context }` when there is. Don't mix the two forms in the same test.

### Components that need `children`

Button, Checkbox, Switch, and Badge accept a `children` snippet. Use `createChildrenSnippet` from test-utils:

```ts
import { createChildrenSnippet } from '../../__tests__/test-utils';

render(Button, {
	children: createChildrenSnippet('Save changes'),
	variant: 'primary'
});
```

### Testing inside a FormField or InputGroup

Some behaviors only appear when a component is composed inside its parent wrapper — for example, TextInput removes its border when inside InputGroup. For these cases, use the **fixture components** in `__tests__/`:

```ts
import FormFieldTextInput from '../../__tests__/FormFieldTextInput.svelte';

render(FormFieldTextInput, {
	label: 'Email',
	dirty: true,
	errors: ['Required']
});
```

This renders a real FormField + TextInput composition, not a mock. Use fixtures when you're testing the integration (e.g., "does disabled propagate from FormField to the child input?"). Use `createFormFieldContext` when you want to isolate the child component's context-reading logic without involving the parent.

### When to create a new fixture

Create a new `.svelte` file in `__tests__/` when:

- You need to test a new component inside `FormField` or `InputGroup`
- You need to test slot/snippet content that can't be created with `createRawSnippet` (e.g., nested components)
- An existing fixture doesn't accept the props you need

Keep fixtures minimal — just the wrapper + child with forwarded props.

## Query Priority

Prefer queries in this order (most to least resilient):

1. **`getByRole`** — `screen.getByRole('button', { name: 'Save' })` — best for accessibility and resilience
2. **`getByLabelText`** — for form inputs with visible labels
3. **`getByPlaceholder`** — for inputs without visible labels
4. **`getByText`** — for non-interactive elements like labels, badges, error messages
5. **`querySelector`** — last resort, for Bits UI data attributes (`[data-pin-input-cell]`) or checking specific DOM structure

Avoid querying by class name to find elements. It's acceptable to _assert_ a class on an element you've already found:

```ts
// Good: find by role, then assert class
const button = screen.getByRole('button');
await expect.element(button).toHaveClass('bg-primary');

// Avoid: find by class
const button = screen.container.querySelector('.bg-primary'); // fragile
```

## Assertion Patterns

### Visibility

```ts
await expect.element(screen.getByRole('textbox')).toBeVisible();
```

### Attributes

```ts
await expect.element(input).toHaveAttribute('aria-invalid', 'true');
await expect.element(input).toHaveAttribute('disabled');
```

### Absence (element should NOT exist)

```ts
const alert = screen.container.querySelector('[role="alert"]');
expect(alert).toBeNull();
```

### Text content

```ts
await expect.element(alert).toHaveTextContent('Email is required');
```

### DOM existence (for IDs, data attributes)

```ts
const el = screen.container.querySelector('#my-id');
expect(el).not.toBeNull();
```

### Interaction

```ts
const checkbox = screen.getByRole('checkbox');
expect(checkbox.element().getAttribute('data-state')).toBe('unchecked');
await checkbox.click();
expect(checkbox.element().getAttribute('data-state')).toBe('checked');
```

### Important: `toBeDefined()` vs `not.toBeNull()`

When checking `getAttribute()` results, never use `toBeDefined()`. `getAttribute` returns `null` when the attribute is absent, and `null` is defined (it's not `undefined`), so `toBeDefined()` always passes.

```ts
// WRONG — always passes
expect(el.getAttribute('data-disabled')).toBeDefined();

// CORRECT
expect(el.getAttribute('data-disabled')).not.toBeNull();

// BETTER — use the built-in matcher
await expect.element(el).toHaveAttribute('data-disabled');
```

## `requireAssertions` Is Enabled

`vite.config.ts` sets `expect.requireAssertions: true`. This means any test that reaches the end without calling `expect()` will **fail**. This catches tests that look like they're passing but aren't actually asserting anything (e.g., a query silently returns nothing and the test never checks it).

## Known Limitations

### Context is static in test-utils

`createFormFieldContext` returns a plain object:

```ts
return new Map([['formField', { id: 'test-field', invalid: false, ... }]]);
```

The real `FormField.svelte` uses **getter properties** so context consumers see reactive updates:

```ts
setContext('formField', {
  get id() { return fieldId; },
  get invalid() { return invalid; },
  ...
});
```

This doesn't matter for tests that set props once at render time (all current tests). But if you write a test that re-renders with new props and expects the child to react to context changes, the mock context won't update. In that case, use a fixture component instead — it runs the real `FormField` with real reactivity.

### Bits UI data attributes

Bits UI components (Checkbox, Switch, PinInput) use `data-state="checked"`, `data-disabled=""`, and similar attributes. These are implementation details of the library, not a public contract. If Bits UI changes how it represents state, tests that query these attributes will break. Prefer `getByRole` and ARIA attributes when possible, and fall back to data attributes only when there's no semantic alternative.

## What to Update When Components Change

### If you rename or move a component

- Move the `.svelte.spec.ts` file alongside it
- Update any imports in other spec files or fixtures
- Check if any fixture in `__tests__/` imports the old path

### If you add a new prop

- Add tests for the new prop's effect on rendering or behavior
- If the prop has a default value, test both the default and an explicit value

### If you change how a component reads context

The context shape is defined by the parent (`FormField`, `InputGroup`) and consumed by children (`TextInput`, `Checkbox`, etc.). If you change the context shape:

1. Update `createFormFieldContext` or `createInputGroupContext` in `test-utils.ts`
2. Update all fixture components that provide the context
3. Update all tests that inject context via `render(..., { context: ... })`

### If you add a new component

1. Create `ComponentName.svelte.spec.ts` next to the component
2. Cover at minimum: rendering, props, accessibility, context (if applicable), interaction (if stateful)
3. If the component needs to be tested inside `FormField` or `InputGroup`, create a fixture in `__tests__/`

### If Bits UI changes its data attribute contract

Search the test files for the affected attribute (e.g., `data-state`, `data-disabled`, `data-pin-input-cell`) and update the queries and assertions.

### If the Tailwind theme changes

Tests that assert specific class names (like `bg-primary`, `border-error`, `text-error`) will need updating. These tests exist to verify the component applies the _correct variant_, not to test CSS itself — so update the class name in the assertion to match the new theme token.
