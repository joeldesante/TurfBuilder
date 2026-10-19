import { z } from 'zod';

/**
 * A physical address, following the UPU S42 address elements without the
 * addressee and without postal delivery services (PO boxes cannot be
 * canvassed). Field names are the S42 element names: "thoroughfare" is any
 * public way an address sits on (street, road, avenue, lane, square), and its
 * type ("St", "Rue") is kept apart from its name.
 *
 * Coordinates and the country are required. Everything else can be missing
 * somewhere in the world, except that an address must identify its building
 * by number or by name.
 */
export const AddressFieldsSchema = z
	.object({
		premises_name: z.string().max(255).nullish(),
		premises_number: z.string().max(40).nullish(),
		thoroughfare_name: z.string().max(255).nullish(),
		thoroughfare_type: z.string().max(40).nullish(),
		thoroughfare_pre_qualifier: z.string().max(40).nullish(),
		thoroughfare_post_qualifier: z.string().max(40).nullish(),
		dependent_locality: z.string().max(120).nullish(),
		locality: z.string().max(120).nullish(),
		region: z.string().max(120).nullish(),
		postcode: z.string().max(20).nullish(),
		country_code: z
			.string()
			.regex(/^[A-Z]{2}$/, 'Use a two-letter uppercase country code.'),
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180)
	})
	.refine((v) => Boolean(v.premises_number) || Boolean(v.premises_name), {
		message: 'An address needs a building number or a building name.',
		path: ['premises_number']
	});

export type AddressFields = z.infer<typeof AddressFieldsSchema>;

/**
 * An apartment, suite, or floor within an address (S42 sub-premises). It has
 * no coordinates of its own; it is canvassed from its address's point.
 */
export const UnitFieldsSchema = z.object({
	unit_type: z.string().max(40).nullish(),
	unit_identifier: z.string().trim().min(1).max(40),
	floor: z.string().max(40).nullish()
});

export type UnitFields = z.infer<typeof UnitFieldsSchema>;
