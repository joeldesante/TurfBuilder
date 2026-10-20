import { z } from 'zod';

/** PUT /api/v1/email-templates/[template_key], and the body of previews. */
export const emailTemplateBodySchema = z.object({
	subject: z.string().trim().min(1, 'The subject cannot be empty.').max(200, 'Keep the subject under 200 characters.'),
	htmlBody: z.string().min(1, 'The email body cannot be empty.').max(100_000, 'The email body is too long.')
});

export type EmailTemplateBody = z.infer<typeof emailTemplateBodySchema>;

/** POST /api/v1/email-templates/[template_key]/test-sends: the text to send, which may be unsaved. */
export const testSendSchema = emailTemplateBodySchema.partial();
