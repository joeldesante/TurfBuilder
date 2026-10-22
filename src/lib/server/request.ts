import { error } from '@sveltejs/kit';
import type { z } from 'zod';

/** The request's JSON body checked against `schema`. Throws 400 with the first problem's message. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
	return parsed.data;
}

const TEMPLATE_KEY = /^[a-z0-9_.-]{1,100}$/;

/** An email template key from a route param, such as `auth.reset_password`. Throws 400 when malformed. */
export function parseTemplateKey(raw: string): string {
	if (!TEMPLATE_KEY.test(raw)) throw error(400, 'Invalid template key');
	return raw;
}
