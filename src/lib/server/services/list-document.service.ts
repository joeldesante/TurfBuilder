import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { uploadObject, StorageNotConfiguredError } from '$lib/server/storage';
import { generatePDF } from './pdf-engine.service';
import { openMapRenderer, type MapRenderer } from './map-engine.service';
import TEMPLATE from './templates/list-document.html?raw';

// The template shows maps at the full 7.3in content width and up to 3.75in
// tall; this size keeps that ratio and prints at roughly 190 dpi.
const MAP_SIZE = { width: 1400, height: 720 };

/**
 * How long a document may take before it is marked failed. Shorter than the
 * client's 2 minute wait, so the page always learns the outcome.
 */
export const GENERATION_TIMEOUT_MS = 90_000;

/**
 * A failure whose message is written for the person who asked for the PDF.
 * Only these messages are stored on the row and shown in the app; anything
 * else is logged and replaced with a generic message, so internal details
 * (storage, database, Chrome) never reach the UI.
 */
export class ListDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ListDocumentError';
	}
}

export const GENERIC_FAILURE =
	'The PDF could not be generated. Try again, or ask an administrator if it keeps happening.';

export interface ListDocumentJob {
	orgId: string;
	documentId: string;
	listId: string;
	storageKey: string;
	/** IANA zone to print times in; the server's own zone when omitted. Replaced by the org setting in #183. */
	timeZone?: string;
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
	const controller = new AbortController();
	const timer = setTimeout(
		() =>
			controller.abort(
				new ListDocumentError('The PDF took too long to generate. Try again shortly.')
			),
		GENERATION_TIMEOUT_MS
	);
	try {
		// The race makes the timeout win even if a render ignores the abort.
		await Promise.race([render(job, controller.signal), whenAborted(controller.signal)]);
		await finish(job, 'ready', null);
	} catch (e) {
		// The full error stays in the server log; the row gets a safe message.
		console.error(`List document ${job.documentId} failed`, e);
		await fail(job, userMessage(e)).catch((err) =>
			console.error(`Could not record failure for list document ${job.documentId}`, err)
		);
	} finally {
		clearTimeout(timer);
	}
}

async function render(job: ListDocumentJob, signal: AbortSignal): Promise<void> {
	const data = await buildDocumentData(job, signal);
	const pdf = await generatePDF(TEMPLATE, data, { signal });
	// Past the deadline the row is already failed; do not leave a file behind.
	signal.throwIfAborted();
	await uploadObject(job.storageKey, pdf, 'application/pdf');
}

/** The message safe to show for a failure; see ListDocumentError. */
function userMessage(e: unknown): string {
	if (e instanceof ListDocumentError) return e.message;
	if (e instanceof StorageNotConfiguredError) {
		return 'PDF storage has not been set up yet. Ask an administrator to configure it.';
	}
	return GENERIC_FAILURE;
}

function whenAborted(signal: AbortSignal): Promise<never> {
	return new Promise((_, reject) =>
		signal.addEventListener('abort', () => reject(signal.reason), { once: true })
	);
}

async function buildDocumentData(
	job: ListDocumentJob,
	signal: AbortSignal
): Promise<ListDocumentData> {
	const { list, entries, turfs } = await withOrgTransaction(job.orgId, (client) =>
		loadList(client, job.orgId, job.listId)
	);

	// One browser draws every map, opened only if some map has something to
	// show, and shut down on timeout so a hung render cannot hold it open.
	let renderer: MapRenderer | undefined;
	const closeRenderer = () => void renderer?.close();
	signal.addEventListener('abort', closeRenderer, { once: true });
	const draw = async (details: MapInput) => {
		renderer ??= await openMapRenderer();
		signal.throwIfAborted();
		return renderer.render(MAP_SIZE, details);
	};

	try {
		const turfPages = [];
		for (const turf of turfs) {
			turfPages.push({
				code: turf.code,
				map: await mapOf(draw, turf.locations, turf.boundary),
				locations: turf.locations.map(toDocumentLocation)
			});
		}

		const now = new Date();
		const zone = job.timeZone;
		return {
			list: { name: list.name },
			generatedAt: `${formatDate(now, zone)} ${formatTime(now, zone)}`,
			expires: {
				date: formatDate(list.expires_at, zone),
				time: formatTime(list.expires_at, zone),
				timezone: formatTimezone(list.expires_at, zone)
			},
			map: await mapOf(draw, entries),
			locations: entries.map(toDocumentLocation),
			turfs: turfPages
		};
	} finally {
		signal.removeEventListener('abort', closeRenderer);
		await renderer?.close();
	}
}

async function loadList(client: PoolClient, orgId: string, listId: string) {
	const listResult = await client.query<{ name: string; entity_type: string; expires_at: Date }>(
		`SELECT name, entity_type, expires_at
		 FROM universe.list
		 WHERE id = $1 AND org_id = $2`,
		[listId, orgId]
	);
	const list = listResult.rows[0];
	if (!list) throw new ListDocumentError('This list no longer exists.');
	if (list.entity_type !== 'locations') {
		throw new ListDocumentError('PDFs can only be generated for location lists.');
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

type MapInput = {
	boundary?: Boundary;
	points: { latitude: number; longitude: number; label: string }[];
};

/**
 * A map of the rows as markers numbered by table position, as a data URI the
 * template can embed. Undefined when there is nothing to frame.
 */
async function mapOf(
	draw: (details: MapInput) => Promise<Uint8Array>,
	rows: LocationRow[],
	boundary?: Boundary
): Promise<string | undefined> {
	const points = rows.flatMap((row, i) =>
		row.latitude != null && row.longitude != null
			? [{ latitude: row.latitude, longitude: row.longitude, label: String(i + 1) }]
			: []
	);
	if (!boundary && points.length === 0) return undefined;

	const jpeg = await draw({ boundary, points });
	return `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`;
}

// Times print in the requester's zone (or the server's, if none was sent),
// labelled with its abbreviation so the reader knows which one.
function formatDate(date: Date, timeZone?: string): string {
	return date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone });
}

function formatTime(date: Date, timeZone?: string): string {
	return date.toLocaleTimeString('en-US', { timeStyle: 'short', timeZone });
}

function formatTimezone(date: Date, timeZone?: string): string {
	const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone }).formatToParts(
		date
	);
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

function finish(job: ListDocumentJob, status: 'ready' | 'failed', error: string | null) {
	return withOrgTransaction(job.orgId, (client) => record(client, job, status, error));
}

function record(
	client: PoolClient,
	job: ListDocumentJob,
	status: 'ready' | 'failed',
	error: string | null
) {
	return client.query<{ deleted_at: Date | null }>(
		`UPDATE universe.list_document
		 SET status = $1, error = $2, completed_at = now()
		 WHERE id = $3 AND org_id = $4
		 RETURNING deleted_at`,
		[status, error, job.documentId, job.orgId]
	);
}

/**
 * Marks the document failed and brings back the documents it replaced, so a
 * failed regeneration leaves the previous PDF downloadable. Skipped if this
 * document was itself replaced meanwhile: a newer one is now current.
 */
function fail(job: ListDocumentJob, error: string) {
	return withOrgTransaction(job.orgId, async (client) => {
		const result = await record(client, job, 'failed', error);
		if (result.rows[0] && result.rows[0].deleted_at === null) {
			await client.query(
				`UPDATE universe.list_document
				 SET deleted_at = NULL, superseded_by = NULL
				 WHERE superseded_by = $1 AND org_id = $2`,
				[job.documentId, job.orgId]
			);
		}
	});
}
