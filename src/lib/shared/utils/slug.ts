/**
 * The URL slug a name turns into: lowercase letters and numbers, joined by single hyphens, with
 * no hyphen at either end. Used for organization and bucket slugs. Empty when the name has no
 * letters or numbers.
 */
export function slugFromName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
