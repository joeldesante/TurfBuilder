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
	private _touched = $state<Record<string, boolean>>({});
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

	validate() {
		const parseResult = this._schema.safeParse(this._data);
		this._valid = parseResult.success;
		this._dirty = true;

		if (parseResult.success) {
			this._errors = {};
			return;
		}

		this._errors = this.formatZodErrors(parseResult.error);
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
		this.validate();

		if (!this.valid) {
			for (const field of Object.keys(this._errors)) {
				this._touched[field] = true;
			}
			this._submitting = false;
			return;
		}

		try {
			await this._onSubmit(this._data);
		} catch (e) {
			this._error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			this._submitting = false;
		}
	}

	reset() {
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

	get errors() {
		return this._errors;
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
		return this._valid;
	}
}
