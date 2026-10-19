import { z } from 'zod';

/**
 * A physical address, following the UPU S42 address elements without the
 * addressee and without postal delivery services (PO boxes cannot be
 * canvassed). Field names are the S42 element names: "thoroughfare" is any
 * public way an address sits on (street, road, avenue, lane, square), and its
 * type ("St", "Rue") is kept apart from its name.
 *
 * A unit (apartment, suite, floor) is an address of its own, with the unit
 * fields set and its own point, as the address standards model subaddresses.
 *
 * Coordinates and the country are required. Everything else can be missing
 * somewhere in the world, except that an address must identify its building
 * by number or by name, and a unit type needs the unit it names.
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
		unit_type: z.string().max(40).nullish(),
		unit_identifier: z.string().trim().min(1).max(40).nullish(),
		floor: z.string().max(40).nullish(),
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180)
	})
	.refine((v) => Boolean(v.premises_number) || Boolean(v.premises_name), {
		message: 'An address needs a building number or a building name.',
		path: ['premises_number']
	})
	.refine((v) => !v.unit_type || Boolean(v.unit_identifier), {
		message: 'A unit type needs a unit number.',
		path: ['unit_identifier']
	});

export type AddressFields = z.infer<typeof AddressFieldsSchema>;
