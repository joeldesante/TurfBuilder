import { z } from 'zod';

/**
 * Shape of a location record as authored by a human — from the admin map, the
 * admin edit form, or a volunteer's field suggestion. Shared by the client
 * forms and the server handlers so validation cannot drift between them.
 *
 * Address parts are kept as individual fields rather than a single free-text
 * blob so that imported and hand-authored records stay comparable.
 */
export const LocationFieldsSchema = z.object({
	name: z.string().max(255).nullish(),
	address_line_1: z.string().max(255).nullish(),
	address_line_2: z.string().max(255).nullish(),
	address_line_3: z.string().max(255).nullish(),
	city: z.string().max(120).nullish(),
	state_or_region: z.string().max(120).nullish(),
	postal_code: z.string().max(20).nullish(),
	country_code: z.string().length(2).nullish(),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	photo_keys: z.array(z.string().max(255)).max(3).default([])
});

/**
 * Partial form used by PATCH handlers. Version rows carry the whole record, so
 * a partial patch must be merged over the current version before insert — see
 * createLocationVersion in $lib/server/locations.
 */
export const LocationPatchSchema = LocationFieldsSchema.partial();

export type LocationFields = z.infer<typeof LocationFieldsSchema>;
export type LocationPatch = z.infer<typeof LocationPatchSchema>;

/**
 * Form-facing counterpart of LocationFieldsSchema. Text fields are plain
 * strings rather than nullable ones so inputs can bind to them directly; an
 * absent value is '' here and becomes null at the API boundary via
 * locationFormToFields.
 */
export const LocationFormSchema = z.object({
	name: z.string().trim().max(255),
	address_line_1: z.string().trim().max(255),
	address_line_2: z.string().trim().max(255),
	address_line_3: z.string().trim().max(255),
	city: z.string().trim().max(120),
	state_or_region: z.string().trim().max(120),
	postal_code: z.string().trim().max(20),
	country_code: z
		.string()
		.trim()
		.refine((v) => v === '' || v.length === 2, 'Use a two-letter country code.'),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	photo_keys: z.array(z.string().max(255)).max(3).default([])
});

export type LocationFormValues = z.infer<typeof LocationFormSchema>;

/** Converts form values to the wire format, blanks becoming nulls. */
export function locationFormToFields(values: LocationFormValues): LocationFields {
	const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());
	return {
		name: blankToNull(values.name),
		address_line_1: blankToNull(values.address_line_1),
		address_line_2: blankToNull(values.address_line_2),
		address_line_3: blankToNull(values.address_line_3),
		city: blankToNull(values.city),
		state_or_region: blankToNull(values.state_or_region),
		postal_code: blankToNull(values.postal_code),
		country_code:
			values.country_code.trim() === '' ? null : values.country_code.trim().toUpperCase(),
		latitude: values.latitude,
		longitude: values.longitude,
		photo_keys: values.photo_keys ?? []
	};
}

/**
 * A canvasser's proposed correction to a location that already exists.
 *
 * Every field is optional because a correction is usually narrow — a wrong
 * name, or a pin on the wrong side of the street — and only the fields sent
 * are applied. Coordinates must be sent as a pair or not at all.
 */
export const LocationEditProposalSchema = LocationFieldsSchema.partial()
	.extend({
		/** Why the record is wrong, in the canvasser's words. */
		note: z.string().max(1000).nullish()
	})
	.refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
		message: 'Send both latitude and longitude, or neither.',
		path: ['latitude']
	});

export type LocationEditProposal = z.infer<typeof LocationEditProposalSchema>;

/** Converts a stored record back into form values for an edit flow. */
export function locationFieldsToForm(fields: Partial<LocationFields>): LocationFormValues {
	return {
		name: fields.name ?? '',
		address_line_1: fields.address_line_1 ?? '',
		address_line_2: fields.address_line_2 ?? '',
		address_line_3: fields.address_line_3 ?? '',
		city: fields.city ?? '',
		state_or_region: fields.state_or_region ?? '',
		postal_code: fields.postal_code ?? '',
		country_code: fields.country_code ?? '',
		latitude: fields.latitude ?? 0,
		longitude: fields.longitude ?? 0,
		photo_keys: fields.photo_keys ?? []
	};
}
