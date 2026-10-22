const VARIABLE = /\{\{(\w+)\}\}/g;

/** Fills a template's {{variables}}. Unknown variables become empty. */
export function fillTemplate(text: string, variables: Record<string, string>): string {
	return text.replace(VARIABLE, (_, key: string) => variables[key] ?? '');
}

/** The distinct {{variables}} a piece of template text uses, in order of first use. */
export function templateVariables(text: string): string[] {
	return [...new Set([...text.matchAll(VARIABLE)].map((match) => match[1]))];
}

/** Variables used in any of the texts that the template does not provide. They would send as blanks. */
export function unknownVariables(texts: string[], allowed: string[]): string[] {
	return [...new Set(texts.flatMap(templateVariables))].filter((name) => !allowed.includes(name));
}
