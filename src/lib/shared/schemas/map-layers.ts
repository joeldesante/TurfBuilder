import { z } from 'zod';

const GEOJSON_TYPES = [
	'FeatureCollection',
	'Feature',
	'Point',
	'MultiPoint',
	'LineString',
	'MultiLineString',
	'Polygon',
	'MultiPolygon',
	'GeometryCollection'
] as const;

const name = z
	.string()
	.trim()
	.min(1, 'Enter a name for the layer.')
	.max(255, 'Name must be 255 characters or fewer.');

const color = z
	.string()
	.regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Choose a color for the layer.');

const labelField = z
	.string()
	.min(1)
	.max(255, 'The label property name is too long.')
	.nullable();

/** Any GeoJSON object. Only the type is checked; MapLibre skips shapes it cannot draw. */
const geojson = z.looseObject({
	type: z.enum(GEOJSON_TYPES, 'The file is not GeoJSON.')
});

export const createMapLayerSchema = z.object({
	name,
	color,
	label_field: labelField.optional().default(null),
	geojson
});

/** The shapes are fixed once a layer is made; only how it is drawn can change. */
export const updateMapLayerSchema = z
	.object({ name, color, label_field: labelField })
	.partial()
	.refine((v) => Object.keys(v).length > 0, 'Nothing to change.');

export const mapLayerOrderSchema = z.object({
	ids: z.array(z.uuid()).max(1000)
});

export type CreateMapLayerInput = z.infer<typeof createMapLayerSchema>;
export type UpdateMapLayerInput = z.infer<typeof updateMapLayerSchema>;
