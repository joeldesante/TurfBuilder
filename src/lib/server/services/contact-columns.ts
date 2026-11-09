/**
 * SQL that reads a contact and its address in the flat location shape the
 * pages use (see `$lib/shared/utils/location-address` for the mapping, which
 * these expressions mirror). Internal to services.
 *
 * Current reads (the data browser, buckets, new lists) use the
 * `universe.v_contacts` view, which has these columns already. Lists and turfs
 * are snapshots, so their reads join the contact version they recorded
 * (`list_entry.record_id`, `turf_location.contact_id`) and the address version
 * they recorded (`address_id`), never the current ones.
 */

/** The flat first address line of address alias `a`. */
export function line1Sql(a: string): string {
	return `COALESCE(NULLIF(concat_ws(' ', ${a}.premises_number, ${a}.thoroughfare_pre_qualifier, ${a}.thoroughfare_name, ${a}.thoroughfare_type, ${a}.thoroughfare_post_qualifier), ''), ${a}.premises_name)`;
}

/** The flat second address line (the unit) of address alias `a`. */
export function line2Sql(a: string): string {
	return `NULLIF(concat_ws(' ', ${a}.unit_type, ${a}.unit_identifier), '')`;
}

/** The contact's name. Every contact so far is a business, named in its metadata. */
export function nameSql(c: string): string {
	return `NULLIF(${c}.metadata->>'name', '')`;
}

/**
 * The flat location columns of contact alias `c` at address alias `a`:
 * `name`, `address_line_1`, `address_line_2`, `city`, `state_or_region`,
 * `postal_code`, `country_code`, `latitude`, `longitude`. Each prefixed with
 * `prefix` when given.
 */
export function locationColumns(c: string, a: string): string {
	return [
		`${nameSql(c)} AS name`,
		`${line1Sql(a)} AS address_line_1`,
		`${line2Sql(a)} AS address_line_2`,
		`${a}.locality AS city`,
		`${a}.region AS state_or_region`,
		`${a}.postcode AS postal_code`,
		`${a}.country_code::text AS country_code`,
		`ST_Y(${a}.coordinates) AS latitude`,
		`ST_X(${a}.coordinates) AS longitude`
	].join(',\n\t');
}

/**
 * Joins the live address of contact alias `c` as alias `a`. Org-scoped by the
 * contact's org, which the caller filters.
 */
export function currentAddressJoin(c: string, a: string): string {
	return `JOIN universe.org_address ${a} ON ${a}.entity_id = ${c}.address_entity_id AND ${a}.org_id = ${c}.org_id AND ${a}.valid_to IS NULL`;
}
