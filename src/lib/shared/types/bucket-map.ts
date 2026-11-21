/** A single location on the bucket map. */
export interface BucketMapPoint {
	id: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	latitude: number;
	longitude: number;
}

/** Several of a bucket's locations, merged into one counted bubble by the server. */
export interface BucketMapCluster {
	/** Stable for the same cell at the same zoom, so a redraw does not flicker. */
	id: string;
	latitude: number;
	longitude: number;
	count: number;
}

/** What the bucket map draws for one viewport: single points, bubbles, or a mix. */
export interface BucketMapViewport {
	points: BucketMapPoint[];
	clusters: BucketMapCluster[];
}

/** The bucket map's opening view. */
export interface BucketMapOverview {
	/** Every location the bucket matches that has a position. */
	total: number;
	/** The box around them, or null when there are none. */
	bounds: { west: number; south: number; east: number; north: number } | null;
}
