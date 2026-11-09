import type { AddressFields } from '$lib/schemas/address';
import type { LocationFields } from '$lib/schemas/location';
import { splitThoroughfare, splitUnit } from './address-parse';

/**
 * The location forms, the CSV import, and the map keep the flat field shape
 * people type (`address_line_1`, `city`, `state_or_region`, `postal_code`).
 * Locations are stored as a contact at a structured address
 * (`universe.org_address`), so this maps one shape onto the other.
 *
 * Reading goes the other way in SQL (`$lib/server/services/contact-columns`):
 * line 1 is the building number and thoroughfare (or the building name when
 * there is no number), line 2 the unit, city the locality, state the region,
 * and postal code the postcode. Line 3 and the floor have no place in the flat
 * shape the other way round, so line 3 is not stored.
 */

/** The building name an address gets when nothing identifies its building. */
export const UNNAMED_PLACE = 'Unnamed place';

/** The address part of a location as the flat shape shows it. */
export type FlatAddress = Pick<
	LocationFields,
	| 'address_line_1'
	| 'address_line_2'
	| 'city'
	| 'state_or_region'
	| 'postal_code'
	| 'country_code'
	| 'latitude'
	| 'longitude'
>;

type StreetFields = Pick<
	AddressFields,
	| 'premises_name'
	| 'premises_number'
	| 'thoroughfare_name'
	| 'thoroughfare_type'
	| 'thoroughfare_pre_qualifier'
	| 'thoroughfare_post_qualifier'
>;

type UnitFields = Pick<AddressFields, 'unit_type' | 'unit_identifier'>;

const blank = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
};

/**
 * Splits a first address line into its building and thoroughfare. A line that
 * starts with a number ("526 Market St", "12B Elm Rd") has that number as the
 * building number; any other line ("Harbour House") is the building's name.
 * With no line at all, the contact's name names the building, as the address
 * backfill does.
 */
export function streetFields(line1: string | null | undefined, name?: string | null): StreetFields {
	const empty: StreetFields = {
		premises_name: null,
		premises_number: null,
		thoroughfare_name: null,
		thoroughfare_type: null,
		thoroughfare_pre_qualifier: null,
		thoroughfare_post_qualifier: null
	};

	const line = blank(line1);
	if (!line) return { ...empty, premises_name: blank(name) ?? UNNAMED_PLACE };

	const numbered = line.match(/^(\d[\w/-]*)\s+(.+)$/);
	if (!numbered) return { ...empty, premises_name: line };

	const road = splitThoroughfare(numbered[2]);
	return {
		...empty,
		premises_number: numbered[1],
		thoroughfare_name: road.name || null,
		thoroughfare_type: road.type,
		thoroughfare_pre_qualifier: road.pre,
		thoroughfare_post_qualifier: road.post
	};
}

/** A second address line as a unit ("Apt 4B"), or no unit when it is empty. */
export function unitFields(line2: string | null | undefined): UnitFields {
	const line = blank(line2);
	if (!line) return { unit_type: null, unit_identifier: null };
	return splitUnit(line);
}

/** The flat first line of an address, as contact-columns reads it back. */
export function addressLine1(address: Partial<StreetFields>): string | null {
	const street = [
		address.premises_number,
		address.thoroughfare_pre_qualifier,
		address.thoroughfare_name,
		address.thoroughfare_type,
		address.thoroughfare_post_qualifier
	]
		.filter((part) => part)
		.join(' ');
	return street || address.premises_name || null;
}

/** The flat second line of an address, as contact-columns reads it back. */
export function addressLine2(address: Partial<UnitFields>): string | null {
	return [address.unit_type, address.unit_identifier].filter((part) => part).join(' ') || null;
}

/**
 * A new address from flat location fields. `defaultCountry` is used when the
 * fields name none, since every address has a country.
 */
export function locationToAddress(
	fields: FlatAddress & { name?: string | null },
	defaultCountry: string
): AddressFields {
	return {
		...streetFields(fields.address_line_1, fields.name),
		...unitFields(fields.address_line_2),
		dependent_locality: null,
		locality: blank(fields.city),
		region: blank(fields.state_or_region),
		postcode: blank(fields.postal_code),
		country_code: blank(fields.country_code)?.toUpperCase() ?? defaultCountry,
		floor: null,
		latitude: fields.latitude,
		longitude: fields.longitude
	};
}

/**
 * The address a location's edit leaves it with. Only what the edit changed is
 * parsed again, so the parts of an address the flat shape does not show (a
 * building name next to its number, the floor) survive an edit that did not
 * touch them.
 *
 * @param current the address now, and the flat shape it reads as
 * @param next the location's flat fields after the edit
 * @returns the new address, or null when the edit leaves the address as it is
 */
export function editedAddress(
	current: AddressFields,
	next: FlatAddress & { name?: string | null }
): AddressFields | null {
	const line1Changed = blank(next.address_line_1) !== blank(addressLine1(current));
	const line2Changed = blank(next.address_line_2) !== blank(addressLine2(current));
	const country = blank(next.country_code)?.toUpperCase() ?? current.country_code;

	const updated: AddressFields = {
		...current,
		...(line1Changed ? streetFields(next.address_line_1, next.name) : {}),
		...(line2Changed ? unitFields(next.address_line_2) : {}),
		locality: blank(next.city),
		region: blank(next.state_or_region),
		postcode: blank(next.postal_code),
		country_code: country,
		latitude: next.latitude,
		longitude: next.longitude
	};

	const same =
		!line1Changed &&
		!line2Changed &&
		updated.locality === (current.locality ?? null) &&
		updated.region === (current.region ?? null) &&
		updated.postcode === (current.postcode ?? null) &&
		updated.country_code === current.country_code &&
		updated.latitude === current.latitude &&
		updated.longitude === current.longitude;

	return same ? null : updated;
}
