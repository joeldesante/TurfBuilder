import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { uploadObject } from '$lib/server/storage';
import { generatePDF } from './pdf-engine.service';
import { renderMap } from './map-engine.service';
import TEMPLATE from './templates/list-document.html?raw';

// The template shows maps at the full 7.3in content width and up to 3.75in
// tall; this size keeps that ratio and prints at roughly 190 dpi.
const MAP_SIZE = { width: 1400, height: 720 };

export interface ListDocumentJob {
	orgId: string;
	documentId: string;
	listId: string;
	storageKey: string;
}

interface LocationRow {
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	latitude: number | null;
	longitude: number | null;
}

type Boundary = GeoJSON.Polygon | GeoJSON.MultiPolygon;

interface DocumentLocation {
	/** Position in its table, 1-based. Matches the marker label on the map. */
	number: number;
	name: string;
	address: string;
}

/** The data list-document.html renders. */
type ListDocumentData = {
	list: { name: string };
	generatedAt: string;
	expires: { date: string; time: string; timezone: string };
	map?: string;
	locations: DocumentLocation[];
	turfs: { code: string; map?: string; locations: DocumentLocation[] }[];
};

/**
 * Renders a list document, uploads it to its reserved key, and records the
 * outcome on the row. Never throws: it runs after the response has been sent,
 * so the row's status is the only place a failure can be reported.
 */
export async function generateListDocument(job: ListDocumentJob): Promise<void> {
	try {
		const data = await buildDocumentData(job.orgId, job.listId);
		const pdf = await generatePDF(TEMPLATE, data);
		await uploadObject(job.storageKey, pdf, 'application/pdf');
		await finish(job, 'ready', null);
	} catch (e) {
		console.error(`List document ${job.documentId} failed`, e);
		const message = e instanceof Error ? e.message : String(e);
		await finish(job, 'failed', message).catch((err) =>
			console.error(`Could not record failure for list document ${job.documentId}`, err)
		);
	}
}

async function buildDocumentData(orgId: string, listId: string): Promise<ListDocumentData> {
	const { list, entries, turfs } = await withOrgTransaction(orgId, (client) =>
		loadList(client, orgId, listId)
	);

	// Maps are drawn one at a time: each one runs its own headless Chrome.
	const turfPages = [];
	for (const turf of turfs) {
		turfPages.push({
			code: turf.code,
			map: await mapOf(turf.locations, turf.boundary),
			locations: turf.locations.map(toDocumentLocation)
		});
	}

	const now = new Date();
	return {
		list: { name: list.name },
		generatedAt: `${formatDate(now)} ${formatTime(now)}`,
		expires: {
			date: formatDate(list.expires_at),
			time: formatTime(list.expires_at),
			timezone: formatTimezone(list.expires_at)
		},
		map: await mapOf(entries),
		locations: entries.map(toDocumentLocation),
		turfs: turfPages
	};
}

async function loadList(client: PoolClient, orgId: string, listId: string) {
	const listResult = await client.query<{ name: string; entity_type: string; expires_at: Date }>(
		`SELECT name, entity_type, expires_at
		 FROM universe.list
		 WHERE id = $1 AND org_id = $2`,
		[listId, orgId]
	);
	const list = listResult.rows[0];
	if (!list) throw new Error('List not found');
	if (list.entity_type !== 'locations') {
		throw new Error('Documents can only be generated for location lists');
	}

	// Joins the snapshotted records (not the view), like the list page, so the
	// document shows the list as it was when it was created.
	const entriesResult = await client.query<LocationRow>(
		`SELECT
			COALESCE(pl.name,            ol.name)            AS name,
			COALESCE(pl.address_line_1,  ol.address_line_1)  AS address_line_1,
			COALESCE(pl.city,            ol.city)            AS city,
			COALESCE(pl.state_or_region, ol.state_or_region) AS state_or_region,
			COALESCE(pl.postal_code,     ol.postal_code)     AS postal_code,
			ST_Y(COALESCE(pl.coordinates, ol.coordinates))   AS latitude,
			ST_X(COALESCE(pl.coordinates, ol.coordinates))   AS longitude
		 FROM universe.list_entry le
		 JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
		 LEFT JOIN universe.public_location pl
			ON le.record_source = 'public_location' AND pl.id = le.record_id
		 LEFT JOIN universe.org_location ol
			ON le.record_source = 'org_location'    AND ol.id = le.record_id
		 WHERE le.list_id = $1
		 ORDER BY COALESCE(pl.city, ol.city), COALESCE(pl.name, ol.name)`,
		[listId, orgId]
	);

	const turfsResult = await client.query<{ id: string; code: string; bounds: string | null }>(
		`SELECT id, code, ST_AsGeoJSON(bounds)::text AS bounds
		 FROM universe.turf
		 WHERE list_id = $1 AND org_id = $2
		 ORDER BY code`,
		[listId, orgId]
	);

	// Current versions only, matching what the turf page shows.
	const turfLocationsResult = await client.query<LocationRow & { turf_id: string }>(
		`SELECT
			tl.turf_id,
			COALESCE(pl.name,            ol.name)            AS name,
			COALESCE(pl.address_line_1,  ol.address_line_1)  AS address_line_1,
			COALESCE(pl.city,            ol.city)            AS city,
			COALESCE(pl.state_or_region, ol.state_or_region) AS state_or_region,
			COALESCE(pl.postal_code,     ol.postal_code)     AS postal_code,
			ST_Y(COALESCE(pl.coordinates, ol.coordinates))   AS latitude,
			ST_X(COALESCE(pl.coordinates, ol.coordinates))   AS longitude
		 FROM universe.turf_location tl
		 LEFT JOIN universe.public_location pl ON tl.public_location_id = pl.id
		 LEFT JOIN universe.org_location ol    ON tl.org_location_id = ol.id
		 WHERE tl.turf_id = ANY($1) AND tl.org_id = $2
		   AND COALESCE(pl.valid_to, ol.valid_to) IS NULL
		 ORDER BY COALESCE(pl.name, ol.name)`,
		[turfsResult.rows.map((t) => t.id), orgId]
	);

	return {
		list,
		entries: entriesResult.rows,
		turfs: turfsResult.rows.map((t) => ({
			code: t.code,
			boundary: t.bounds ? (JSON.parse(t.bounds) as Boundary) : undefined,
			locations: turfLocationsResult.rows.filter((l) => l.turf_id === t.id)
		}))
	};
}

function toDocumentLocation(row: LocationRow, index: number): DocumentLocation {
	const region = [row.state_or_region, row.postal_code].filter(Boolean).join(' ');
	return {
		number: index + 1,
		name: row.name ?? 'Unnamed location',
		address: [row.address_line_1, row.city, region].filter(Boolean).join(', ')
	};
}

/**
 * A map of the rows as markers numbered by table position, as a data URI the
 * template can embed. Undefined when there is nothing to frame.
 */
async function mapOf(rows: LocationRow[], boundary?: Boundary): Promise<string | undefined> {
	const points = rows.flatMap((row, i) =>
		row.latitude != null && row.longitude != null
			? [{ latitude: row.latitude, longitude: row.longitude, label: String(i + 1) }]
			: []
	);
	if (!boundary && points.length === 0) return undefined;

	const jpeg = await renderMap(MAP_SIZE, { boundary, points });
	return `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`;
}

// Organizations have no timezone setting yet, so times print in the server's
// zone, labelled with its abbreviation so the reader knows which one.
function formatDate(date: Date): string {
	return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString('en-US', { timeStyle: 'short' });
}

function formatTimezone(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

function finish(job: ListDocumentJob, status: 'ready' | 'failed', error: string | null) {
	return withOrgTransaction(job.orgId, (client) =>
		client.query(
			`UPDATE universe.list_document
			 SET status = $1, error = $2, completed_at = now()
			 WHERE id = $3 AND org_id = $4`,
			[status, error, job.documentId, job.orgId]
		)
	);
}
