import { z } from 'zod';

const name = z
	.string()
	.trim()
	.min(1, 'Enter a name')
	.max(255, 'Name must be 255 characters or fewer.');

/** Body of `POST /api/v1/buckets/{bucket_id}/scripts`. A new script starts empty unless `contents` is sent. */
export const createScriptSchema = z.object({
	name,
	contents: z.string().optional()
});

/** Body of `PATCH /api/v1/scripts/{script_id}`. Omitted fields keep their value. */
export const updateScriptSchema = z.object({
	name: name.optional(),
	contents: z.string().optional()
});

export type CreateScriptInput = z.infer<typeof createScriptSchema>;
export type UpdateScriptInput = z.infer<typeof updateScriptSchema>;
