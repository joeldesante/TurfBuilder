import { z } from 'zod';

/**
 * The kinds of contact an organization canvasses. A contact is anything that
 * is canvassed at an address (a business today, a resident later); the kinds
 * differ only in their metadata, so each one is a schema here rather than a
 * table. Adding a kind means adding an entry: validation, display, and later
 * forms and filters all read the same definition.
 *
 * universe.org_contact.type stores the slug and universe.org_contact.metadata
 * the object the schema accepts. The database only checks that metadata is a
 * JSON object, so every write goes through validateContactMetadata.
 */

interface ContactTypeDefinition<S extends z.ZodTypeAny> {
	label: string;
	metadata: S;
	/** The name shown for a contact of this type. */
	displayName: (metadata: z.infer<S>) => string;
}

function defineContactType<S extends z.ZodTypeAny>(definition: ContactTypeDefinition<S>) {
	return definition;
}

export const CONTACT_TYPES = {
	business: defineContactType({
		label: 'Business',
		// Empty when the business has not been named yet, as for most imported doors.
		metadata: z.object({ name: z.string().max(255) }).strict(),
		displayName: (m) => m.name
	})
} as const;

export type ContactType = keyof typeof CONTACT_TYPES;
export type ContactMetadata<T extends ContactType> = z.infer<(typeof CONTACT_TYPES)[T]['metadata']>;

export function isContactType(value: string): value is ContactType {
	return Object.hasOwn(CONTACT_TYPES, value);
}

/**
 * Checks metadata against its type's schema.
 *
 * @returns the parsed metadata, or an error message safe to show a user
 */
export function validateContactMetadata(
	type: string,
	metadata: unknown
): { ok: true; metadata: Record<string, unknown> } | { ok: false; error: string } {
	if (!isContactType(type)) return { ok: false, error: `Unknown contact type: ${type}` };
	const result = CONTACT_TYPES[type].metadata.safeParse(metadata);
	if (!result.success) {
		return { ok: false, error: `Invalid ${CONTACT_TYPES[type].label.toLowerCase()} details.` };
	}
	return { ok: true, metadata: result.data };
}

/** The name to show for a contact, by its type's rule. */
export function contactDisplayName(type: string, metadata: unknown): string {
	const checked = validateContactMetadata(type, metadata);
	if (!checked.ok || !isContactType(type)) return '';
	return CONTACT_TYPES[type].displayName(checked.metadata as never);
}
