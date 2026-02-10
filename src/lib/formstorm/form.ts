import type { ZodType } from "zod";
import { z } from "zod";
import { init as GenerateObjectFromSchema } from "zod-empty";

class Form {

    private _schema: ZodType;
    private _data: unknown;
    private _dirty: boolean = $state(false);
    private _submitting: boolean = $state(false);
    private _valid: boolean = $state(false);
    private _error: string = $state("");
    private _onSubmit: (data: z.infer<typeof this._schema>) => Promise<void>;

    constructor(schema: ZodType, onSubmit: (data: z.infer<typeof this._schema>) => Promise<void>) {
        this._schema = schema;
        this.reset();   // Sets the data to a blank object that matches the schema shape.
        this._onSubmit = onSubmit;
        this.validate();
    }

    validate() {
        const parseResult = this._schema.safeParse(this._data);
        this._valid = parseResult.success;
        this._error = parseResult.error?.message || "";
    }
    
    submit() {
        this._submitting = true;
        this._onSubmit(this._data);
    }

    reset() {
        this._data = $state(GenerateObjectFromSchema(this._schema));
        this._submitting = false;
        this._dirty = false;
        this._valid = false;
    }

    get values(): z.infer<typeof this._schema> {
        return this._data;
    }

    get errors() {
        return {}
    }        // Per-field error arrays: { username: ['Too short'] }

    get dirty() {
        return this._dirty;
    }         // Has any field changed from initial?
    
    get submitting() { 
        return this._submitting;
    }    // Is onSubmit currently running?

    get errorMessage() { 
        return this._error;
    }           // Form-level error string (network failures, etc.)
    
    get valid() { 
        return this._valid; 
    }         // Does the form currently pass validation?
}