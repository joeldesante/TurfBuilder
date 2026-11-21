const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' '
};

/**
 * Turns a catalogue description into plain text: tags become spaces, common entities are
 * decoded, whitespace is collapsed, and the result is cut to `max` characters.
 */
export function plainText(value: string | null | undefined, max = 300): string {
	return (value ?? '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (entity) => ENTITIES[entity])
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}
