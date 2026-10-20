/**
 * Turns libpostal output into S42 address fields, and groups spelling
 * variants of one address. Pure: the libpostal calls happen in
 * scripts/backfill-addresses.ts, which passes their results in.
 */

/** One component from libpostal's parser, e.g. { label: 'road', value: 'harlan st' }. */
export interface ParsedComponent {
	label: string;
	value: string;
}

export interface ParsedAddress {
	premises_name: string | null;
	premises_number: string | null;
	thoroughfare_name: string | null;
	thoroughfare_type: string | null;
	thoroughfare_pre_qualifier: string | null;
	thoroughfare_post_qualifier: string | null;
	dependent_locality: string | null;
	locality: string | null;
	region: string | null;
	postcode: string | null;
	unit: { unit_type: string | null; unit_identifier: string } | null;
	floor: string | null;
	/** True when libpostal found neither a building number nor a building name. */
	needsReview: boolean;
}

/** Directionals that qualify a thoroughfare, before or after its name. */
const DIRECTIONALS = new Set([
	'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
	'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'
]);

/**
 * Common thoroughfare types (USPS street suffixes, full and abbreviated). Only
 * split off when something is left for the name, so "Broadway" stays a name.
 */
const THOROUGHFARE_TYPES = new Set([
	'aly', 'alley', 'ave', 'av', 'avenue', 'blvd', 'boulevard', 'cir', 'circle',
	'ct', 'court', 'cv', 'cove', 'dr', 'drive', 'expy', 'expressway', 'hwy', 'highway',
	'ln', 'lane', 'loop', 'pike', 'pkwy', 'parkway', 'pl', 'place', 'plz', 'plaza',
	'rd', 'road', 'row', 'sq', 'square', 'st', 'street', 'ter', 'terrace', 'trl', 'trail',
	'way', 'xing', 'crossing'
]);

/** Words that name a unit's type rather than identify it. */
const UNIT_TYPES = new Set([
	'apt', 'apartment', 'unit', 'ste', 'suite', 'rm', 'room', 'fl', 'floor', 'bldg',
	'building', 'lot', 'spc', 'space', '#'
]);

/**
 * Finds `value` in `original` ignoring case, and returns the original's
 * casing. libpostal lowercases everything it returns.
 */
export function recoverCase(original: string, value: string): string {
	const index = original.toLowerCase().indexOf(value.toLowerCase());
	return index === -1 ? value : original.slice(index, index + value.length);
}

/** Splits a road into pre-qualifier, name, type, and post-qualifier. */
export function splitThoroughfare(road: string): {
	pre: string | null;
	name: string;
	type: string | null;
	post: string | null;
} {
	const words = road.trim().split(/\s+/);
	const bare = (w: string) => w.toLowerCase().replace(/\.$/, '');

	let pre: string | null = null;
	let post: string | null = null;
	let type: string | null = null;

	// From the end inward, so a directional that is the whole name ("North Ave")
	// stays the name: the type comes off first, and a leading directional is
	// only a qualifier while a word is left for the name.
	if (words.length > 1 && DIRECTIONALS.has(bare(words[words.length - 1]))) post = words.pop()!;
	if (words.length > 1 && THOROUGHFARE_TYPES.has(bare(words[words.length - 1]))) type = words.pop()!;
	if (words.length > 1 && DIRECTIONALS.has(bare(words[0]))) pre = words.shift()!;

	return { pre, name: words.join(' '), type, post };
}

/** Splits "Apt 4B" into its type and identifier; a bare "4B" has no type. */
export function splitUnit(text: string): { unit_type: string | null; unit_identifier: string } {
	const match = text.trim().match(/^(#|[^\s#]+)\s*(.+)$/);
	if (match && UNIT_TYPES.has(match[1].toLowerCase().replace(/\.$/, ''))) {
		return { unit_type: match[1], unit_identifier: match[2].trim() };
	}
	return { unit_type: null, unit_identifier: text.trim() };
}

/**
 * Maps libpostal components onto S42 fields.
 *
 * @param components libpostal's parse of `original`
 * @param original the text that was parsed, used to restore casing
 * @param line1 the location's first address line, kept whole as the building
 *   name when libpostal finds no building, so nothing is lost
 */
export function toAddressFields(
	components: ParsedComponent[],
	original: string,
	line1: string | null
): ParsedAddress {
	const get = (label: string) => {
		const found = components.find((c) => c.label === label);
		return found ? recoverCase(original, found.value) : null;
	};

	const road = get('road');
	const split = road ? splitThoroughfare(road) : null;
	const unitText = get('unit');
	const premisesNumber = get('house_number');
	const premisesName = get('house');
	const needsReview = !premisesNumber && !premisesName;

	return {
		premises_name: premisesName ?? (needsReview ? (line1?.trim() || original) : null),
		premises_number: premisesNumber,
		thoroughfare_name: split?.name || null,
		thoroughfare_type: split?.type ?? null,
		thoroughfare_pre_qualifier: split?.pre ?? null,
		thoroughfare_post_qualifier: split?.post ?? null,
		dependent_locality: get('suburb') ?? get('city_district'),
		locality: get('city'),
		region: get('state'),
		postcode: get('postcode'),
		unit: unitText ? splitUnit(unitText) : null,
		floor: get('level'),
		needsReview
	};
}

/**
 * The text libpostal should expand to compare addresses: the premises, the
 * thoroughfare, and the unit. A unit is an address of its own, so two
 * apartments in one building stay two addresses.
 */
export function addressText(parsed: ParsedAddress): string {
	return [
		parsed.premises_number ?? parsed.premises_name,
		parsed.thoroughfare_pre_qualifier,
		parsed.thoroughfare_name,
		parsed.thoroughfare_type,
		parsed.thoroughfare_post_qualifier,
		parsed.unit?.unit_type,
		parsed.unit?.unit_identifier
	]
		.filter(Boolean)
		.join(' ');
}

/**
 * Keys under which an address can match another. Each libpostal expansion of
 * the address text ("2445 harlan street", ...) is scoped by postcode (or
 * locality) and country, so the same street in two towns never merges.
 */
export function dedupeKeys(
	expansions: string[],
	parsed: ParsedAddress,
	countryCode: string
): string[] {
	const area = (parsed.postcode ?? parsed.locality ?? '').toLowerCase().replace(/\s+/g, '');
	return expansions.map((e) => `${countryCode}|${area}|${e.toLowerCase()}`);
}
