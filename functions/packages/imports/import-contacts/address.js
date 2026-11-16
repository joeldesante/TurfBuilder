'use strict';

// A copy of the address parsing in src/lib/shared/utils/address-parse.ts and
// location-address.ts (streetFields, unitFields), because this function is deployed on its
// own and cannot import from the app. The app's spec
// src/lib/shared/utils/address-parse.functions-parity.spec.ts runs both over the same
// addresses and fails if they ever give different answers, so change both together.

const DIRECTIONALS = new Set([
	'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
	'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'
]);

const THOROUGHFARE_TYPES = new Set([
	'aly', 'alley', 'ave', 'av', 'avenue', 'blvd', 'boulevard', 'cir', 'circle',
	'ct', 'court', 'cv', 'cove', 'dr', 'drive', 'expy', 'expressway', 'hwy', 'highway',
	'ln', 'lane', 'loop', 'pike', 'pkwy', 'parkway', 'pl', 'place', 'plz', 'plaza',
	'rd', 'road', 'row', 'sq', 'square', 'st', 'street', 'ter', 'terrace', 'trl', 'trail',
	'way', 'xing', 'crossing'
]);

const UNIT_TYPES = new Set([
	'apt', 'apartment', 'unit', 'ste', 'suite', 'rm', 'room', 'fl', 'floor', 'bldg',
	'building', 'lot', 'spc', 'space', '#'
]);

/** The building name an address gets when nothing identifies its building. */
const UNNAMED_PLACE = 'Unnamed place';

const blank = (value) => {
	const trimmed = typeof value === 'string' ? value.trim() : '';
	return trimmed ? trimmed : null;
};

function splitThoroughfare(road) {
	const words = road.trim().split(/\s+/);
	const bare = (w) => w.toLowerCase().replace(/\.$/, '');

	let pre = null;
	let post = null;
	let type = null;

	if (words.length > 1 && DIRECTIONALS.has(bare(words[words.length - 1]))) post = words.pop();
	if (words.length > 1 && THOROUGHFARE_TYPES.has(bare(words[words.length - 1]))) type = words.pop();
	if (words.length > 1 && DIRECTIONALS.has(bare(words[0]))) pre = words.shift();

	return { pre, name: words.join(' '), type, post };
}

function splitUnit(text) {
	const match = text.trim().match(/^(#|[^\s#]+)\s*(.+)$/);
	if (match && UNIT_TYPES.has(match[1].toLowerCase().replace(/\.$/, ''))) {
		return { unit_type: match[1], unit_identifier: match[2].trim() };
	}
	return { unit_type: null, unit_identifier: text.trim() };
}

/** A first address line as building and thoroughfare fields. A line with no number is the building's name. */
function streetFields(line1, name) {
	const empty = {
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
function unitFields(line2) {
	const line = blank(line2);
	if (!line) return { unit_type: null, unit_identifier: null };
	return splitUnit(line);
}

module.exports = { blank, streetFields, unitFields };
