import type { ZodObject, ZodRawShape } from 'zod';
import { z } from 'zod';
import { init as GenerateObjectFromSchema } from 'zod-empty';

export type FormValidationError = Record<string, string[]>;

export class Form<TSchema extends ZodObject<ZodRawShape>> {
	private _schema: TSchema;
	private _data;
	private _dirty = $state(false);
	private _submitting = $state(false);
	private _valid = $state(false);
	private _error = $state('');
	private _errors = $state<Record<string, string[]>>({});
	/** Errors set from outside the schema, such as an async check. validate() leaves them alone. */
	private _external = $state<Record<string, string>>({});
	private _touched = $state<Record<string, boolean>>({});
	/** Schema errors merged with external ones; rebuilt only when either changes. */
	private _allErrors = $derived.by(() => {
		const merged: Record<string, string[]> = { ...this._errors };
		for (const [field, message] of Object.entries(this._external)) {
			merged[field] = [...(merged[field] ?? []), message];
		}
		return merged;
	});
	private _onSubmit: (data: z.infer<TSchema>) => Promise<void>;

	constructor(
		schema: TSchema,
		onSubmit: (data: z.infer<TSchema>) => Promise<void>,
		initialValues?: Partial<z.infer<TSchema>>
	) {
		this._schema = schema;
		this._data = $state<z.infer<TSchema>>({
			...(GenerateObjectFromSchema(this._schema) as z.infer<TSchema>),
			...initialValues
		});
		this._onSubmit = onSubmit;
	}

	/** Validates the current values and returns the parse result, whose `data` is the cleaned output. */
	validate() {
		const parseResult = this._schema.safeParse(this._data);
		this._valid = parseResult.success;
		this._dirty = true;

		if (parseResult.success) {
			this._errors = {};
			return parseResult;
		}

		this._errors = this.formatZodErrors(parseResult.error);
		return parseResult;
	}

	/**
	 * Marks a field invalid with a message the schema cannot know, such as "that slug is taken"
	 * from a server check. It shows in `errors` and keeps `valid` false, so submit is blocked,
	 * until `clearFieldError` removes it. `validate()` and `touch()` do not clear it.
	 */
	setFieldError(field: string, message: string) {
		this._external[field] = message;
	}

	/** Removes an error set with `setFieldError`. */
	clearFieldError(field: string) {
		delete this._external[field];
	}

	touch(field: string) {
		this._touched[field] = true;
		this._error = '';
		this.validate();
	}

	private formatZodErrors(error: z.ZodError): FormValidationError {
		const fieldErrors: FormValidationError = {};

		for (const issue of error.issues) {
			const path = issue.path.join('.');

			if (!fieldErrors[path]) {
				fieldErrors[path] = [];
			}

			fieldErrors[path].push(issue.message);
		}

		return fieldErrors;
	}

	async submit() {
		this._submitting = true;
		this._error = '';
		const parsed = this.validate();

		if (!parsed.success || !this.valid) {
			for (const field of Object.keys(this.errors)) {
				this._touched[field] = true;
			}
			this._submitting = false;
			return;
		}

		try {
			// The parsed output: trimmed, coerced, defaulted, unknown keys stripped, and a plain object.
			await this._onSubmit(parsed.data as z.infer<TSchema>);
		} catch (e) {
			this._error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			this._submitting = false;
		}
	}

	reset() {
		this._external = {};
		const newData = GenerateObjectFromSchema(this._schema) as z.infer<TSchema>;
		Object.assign(this._data, newData);
		this._submitting = false;
		this._dirty = false;
		this._valid = false;
		this._error = '';
		this._errors = {};
		this._touched = {};
	}

	get values(): z.infer<TSchema> {
		return this._data;
	}

	/** Schema errors by field, plus any set with `setFieldError`. */
	get errors() {
		return this._allErrors;
	}

	get touched() {
		return this._touched;
	}

	get dirty() {
		return this._dirty;
	}

	get submitting() {
		return this._submitting;
	}

	get errorMessage() {
		return this._error;
	}

	get valid() {
		return this._valid && Object.keys(this._external).length === 0;
	}
}
