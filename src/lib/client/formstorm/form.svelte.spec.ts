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

	it('passes the parsed result to onSubmit: transformed, defaulted, and without unknown keys', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const schema = z.object({
			name: z.string().trim().min(1),
			count: z.coerce.number().default(3)
		});
		const form = new Form(schema, onSubmit, {
			name: '  Alice  ',
			extra: 'leaked'
		} as never);
		await form.submit();
		expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice', count: 3 });
	});

	it('passes a plain object, not the live form state', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const form = new Form(testSchema, onSubmit);
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		await form.submit();
		expect(onSubmit.mock.calls[0][0]).not.toBe(form.values);
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

describe('Form — setFieldError() and clearFieldError()', () => {
	function validForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
		const form = makeForm(onSubmit);
		form.values.name = 'Alice';
		form.values.email = 'alice@example.com';
		return form;
	}

	it('adds the message to the field errors', () => {
		const form = makeForm();
		form.setFieldError('name', 'Already taken');
		expect(form.errors.name).toEqual(['Already taken']);
	});

	it('keeps schema errors for the same field and adds the message after them', () => {
		const form = makeForm();
		form.validate();
		form.setFieldError('name', 'Already taken');
		expect(form.errors.name).toEqual(['Name is required', 'Already taken']);
	});

	it('makes a valid form invalid', () => {
		const form = validForm();
		form.validate();
		expect(form.valid).toBe(true);

		form.setFieldError('name', 'Already taken');

		expect(form.valid).toBe(false);
	});

	it('survives validate() and touch()', () => {
		const form = validForm();
		form.setFieldError('name', 'Already taken');

		form.validate();
		form.touch('name');

		expect(form.errors.name).toEqual(['Already taken']);
		expect(form.valid).toBe(false);
	});

	it('blocks submit while the error is set', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const form = validForm(onSubmit);
		form.setFieldError('name', 'Already taken');

		await form.submit();

		expect(onSubmit).not.toHaveBeenCalled();
		expect(form.touched.name).toBe(true);
	});

	it('lets submit through once the error is cleared', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const form = validForm(onSubmit);
		form.setFieldError('name', 'Already taken');
		form.clearFieldError('name');

		await form.submit();

		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('clearing a field with no error does nothing', () => {
		const form = makeForm();
		form.clearFieldError('name');
		expect(form.errors).toEqual({});
	});

	it('is removed by reset()', () => {
		const form = makeForm();
		form.setFieldError('name', 'Already taken');
		form.reset();
		expect(form.errors).toEqual({});
	});
});
