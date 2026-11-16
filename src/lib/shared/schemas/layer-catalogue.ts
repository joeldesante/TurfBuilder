import { z } from 'zod';
import { CKAN_PORTALS } from '$lib/shared/registries/layer-catalogue';

export const dataGovSearchSchema = z.object({
	q: z.string().trim().max(200).default(''),
	after: z.string().max(500).optional(),
	/** Only datasets published by a government. */
	official: z.enum(['0', '1']).default('0').transform((value) => value === '1')
});

export const ckanSearchSchema = z.object({
	portal: z.enum(CKAN_PORTALS.map((portal) => portal.id) as [string, ...string[]]),
	q: z.string().trim().max(200).default(''),
	start: z.coerce.number().int().min(0).max(100000).default(0)
});
