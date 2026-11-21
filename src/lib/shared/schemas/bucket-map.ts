import { z } from 'zod';

/** A map viewport in degrees plus the map's zoom, from query parameters. */
export const bucketMapViewportSchema = z.object({
	west: z.coerce.number().min(-180).max(180),
	south: z.coerce.number().min(-90).max(90),
	east: z.coerce.number().min(-180).max(180),
	north: z.coerce.number().min(-90).max(90),
	zoom: z.coerce.number().min(0).max(24)
});

export type BucketMapViewportQuery = z.infer<typeof bucketMapViewportSchema>;
