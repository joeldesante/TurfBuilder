/**
 * How a choose-many (`check`) survey answer is stored: the picked choices joined
 * with commas, each with its own commas escaped so a choice such as "Yes,
 * definitely" stays one choice. Only `%` and `,` are escaped, so an answer whose
 * choices have neither, which is every answer saved before this format, reads
 * exactly as it was stored.
 */

/** Escapes a choice so it can sit between the commas of a stored answer. */
export function encodeChoice(choice: string): string {
	return choice.replace(/%/g, '%25').replace(/,/g, '%2C');
}

/** Reverses `encodeChoice`. */
export function decodeChoice(encoded: string): string {
	return encoded.replace(/%2C/gi, ',').replace(/%25/g, '%');
}

/** The stored answer for the picked choices. */
export function joinChoices(choices: readonly string[]): string {
	return choices.map(encodeChoice).join(',');
}

/** The choices a stored answer holds. Empty for no answer. */
export function splitChoices(value: string | null | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.filter((part) => part !== '')
		.map(decodeChoice);
}

/** A stored answer as people read it: a choose-many answer lists its choices. */
export function formatAnswer(questionType: string, value: string | null | undefined): string {
	if (questionType !== 'check') return value ?? '';
	return splitChoices(value).join(', ');
}
