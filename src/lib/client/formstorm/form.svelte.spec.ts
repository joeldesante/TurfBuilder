import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Form } from './form.svelte.js';

const testSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.string().email('Invalid email address')
});

function makeForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
	return new Form(testSchema, onSubmit);
}

describe('Form — initial state', () => {
	it('is not dirty', () => {
		expect(makeForm().dirty).toBe(false);
	});

	it('is not submitting', () => {
		expect(makeForm().submitting).toBe(false);
	});

	it('is not valid', () => {
		expect(makeForm().valid).toBe(false);
	});

	it('has no errors', () => {
		expect(makeForm().errors).toEqual({});
	});

	it('exposes a values object', () => {
		expect(makeForm().values).toBeDefined();
	});
});

describe('Form — validate()', () => {
	it('marks the form as dirty', () => {
		const form = makeForm();
		form.validate();
		expect(form.dirty).toBe(true);
	});

	it('sets valid to false when data is invalid', () => {
		const form = makeForm();
		form.validate();
		expect(form.valid).toBe(false);
	});

	it('populates errors when data is invalid', () => {
		const form = makeForm();
		form.validate();
		expect(Object.keys(form.errors).length).toBeGreaterThan(0);
	});

	it('sets valid to true when all fields pass', () => {
		const form = makeForm();
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.validate();
		expect(form.valid).toBe(true);
	});

	it('clears errors after data becomes valid', () => {
		const form = makeForm();
		form.validate();
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.validate();
		expect(form.errors).toEqual({});
	});

	it('assigns error messages to the correct field path', () => {
		const form = makeForm();
		form.values.name = '';
		form.validate();
		expect(form.errors['name']).toBeDefined();
	});

	it('includes the schema-defined message in field errors', () => {
		const form = makeForm();
		form.values.name = '';
		form.validate();
		expect(form.errors['name']).toContain('Name is required');
	});
});

describe('Form — submit()', () => {
	it('does not call onSubmit when the form is invalid', () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const form = new Form(testSchema, onSubmit);
		form.submit();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('calls onSubmit when the form is valid', () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const form = new Form(testSchema, onSubmit);
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.submit();
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('sets submitting to true', () => {
		const form = makeForm();
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.submit();
		expect(form.submitting).toBe(true);
	});

	it('validates the form before attempting submission', () => {
		const form = makeForm();
		form.submit();
		expect(form.dirty).toBe(true);
	});
});

describe('Form — reset()', () => {
	it('clears dirty state', () => {
		const form = makeForm();
		form.validate();
		form.reset();
		expect(form.dirty).toBe(false);
	});

	it('clears submitting state', () => {
		const form = makeForm();
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.submit();
		form.reset();
		expect(form.submitting).toBe(false);
	});

	it('clears valid state', () => {
		const form = makeForm();
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		form.validate();
		form.reset();
		expect(form.valid).toBe(false);
	});
});
