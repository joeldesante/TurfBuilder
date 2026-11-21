/** A GeoJSON object as uploaded: a FeatureCollection, a Feature, or a bare geometry. */
export interface LayerGeoJSON {
	type: string;
	[key: string]: unknown;
}

/**
 * A map layer without its shapes: what lists of layers carry. The GeoJSON can
 * run to megabytes, so it is fetched one layer at a time, when it is shown.
 */
export interface MapLayerSummary {
	id: string;
	name: string;
	color: string;
	/** The feature property drawn as each shape's label, or null for none. */
	label_field: string | null;
	/** 0 is the top of the stack; larger numbers sit further down. */
	position: number;
	created_at: string;
	updated_at: string;
}

/** A map layer as stored: a named set of shapes drawn in one color. */
export interface MapLayer {
	id: string;
	name: string;
	color: string;
	/** The feature property drawn as each shape's label, or null for none. */
	label_field: string | null;
	/** 0 is the top of the stack; larger numbers sit further down. */
	position: number;
	geojson: LayerGeoJSON;
	created_at: string;
	updated_at: string;
}
