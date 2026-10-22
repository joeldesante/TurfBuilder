import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { uploadObject, StorageNotConfiguredError } from '$lib/server/storage';
import { generatePDF } from './pdf-engine.service';
import { recordEvent } from './activity.service';
import { openMapRenderer, type MapRenderer } from './map-engine.service';
import TEMPLATE from './templates/list-document.html?raw';
import { logger } from '$lib/server/logger';

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

/** What a run measured, logged with its outcome to show where time and memory went. */
interface RunStats {
	locations?: number;
	turfs?: number;
	maps?: number;
	loadMs?: number;
	mapsMs?: number;
	pdfMs?: number;
	uploadMs?: number;
	pdfBytes?: number;
}

const elapsed = (since: number) => Math.round(performance.now() - since);
const rssMb = () => Math.round(process.memoryUsage.rss() / 1024 / 1024);

/**
 * Renders a list document, uploads it to its reserved key, and records the
 * outcome on the row. Never throws: it runs after the response has been sent,
 * so the row's status is the only place a failure can be reported.
 */
export async function generateListDocument(job: ListDocumentJob): Promise<void> {
	const controller = new AbortController();
	const startedAt = performance.now();
	const stats: RunStats = {};
	// Ids only: names, addresses and turf codes are the org's data.
	const context = { documentId: job.documentId, organizationId: job.orgId, listId: job.listId };
	logger.info({ ...context, rssMb: rssMb() }, 'List document generation started');
	const timer = setTimeout(
		() =>
			controller.abort(
				new ListDocumentError('The PDF took too long to generate. Try again shortly.')
			),
		GENERATION_TIMEOUT_MS
	);
	try {
		// The race makes the timeout win even if a render ignores the abort.
		await Promise.race([render(job, controller.signal, stats), whenAborted(controller.signal)]);
		await finish(job, 'ready', null);
		logger.info(
			{ ...context, ...stats, totalMs: elapsed(startedAt), rssMb: rssMb() },
			'List document generated'
		);
		await recordEvent('document.generated', {
			orgId: job.orgId,
			metadata: { listId: job.listId },
			sourceKey: `document:${job.documentId}`
		});
	} catch (e) {
		// The full error stays in the server log; the row gets a safe message.
		logger.error(
			{
				err: e,
				...context,
				...stats,
				timedOut: controller.signal.aborted,
				totalMs: elapsed(startedAt),
				rssMb: rssMb()
			},
			'List document failed'
		);
		await fail(job, userMessage(e)).catch((err) =>
			logger.error({ err, ...context }, 'List document failure could not be saved on its row; it will stay pending')
		);
		await recordEvent('document.failed', {
			orgId: job.orgId,
			metadata: { listId: job.listId, error: userMessage(e) },
			sourceKey: `document:${job.documentId}`
		});
	} finally {
		clearTimeout(timer);
	}
}

async function render(job: ListDocumentJob, signal: AbortSignal, stats: RunStats): Promise<void> {
	const data = await buildDocumentData(job, signal, stats);

	let phaseStart = performance.now();
	const pdf = await generatePDF(TEMPLATE, data, { signal });
	stats.pdfMs = elapsed(phaseStart);
	stats.pdfBytes = pdf.byteLength;

	// Past the deadline the row is already failed; do not leave a file behind.
	signal.throwIfAborted();
	phaseStart = performance.now();
	await uploadObject(job.storageKey, pdf, 'application/pdf');
	stats.uploadMs = elapsed(phaseStart);
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
	signal: AbortSignal,
	stats: RunStats
): Promise<ListDocumentData> {
	const loadStart = performance.now();
	const { list, entries, turfs } = await withOrgTransaction(job.orgId, (client) =>
		loadList(client, job.orgId, job.listId)
	);
	stats.loadMs = elapsed(loadStart);
	stats.locations = entries.length;
	stats.turfs = turfs.length;
	stats.maps = 0;
	stats.mapsMs = 0;

	// One browser draws every map, opened only if some map has something to
	// show, and shut down on timeout so a hung render cannot hold it open.
	let renderer: MapRenderer | undefined;
	const closeRenderer = () => void renderer?.close();
	signal.addEventListener('abort', closeRenderer, { once: true });
	const draw = async (details: MapInput) => {
		const mapStart = performance.now();
		renderer ??= await openMapRenderer();
		signal.throwIfAborted();
		const jpeg = await renderer.render(MAP_SIZE, details);
		stats.maps! += 1;
		stats.mapsMs! += elapsed(mapStart);
		return jpeg;
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
			ol.name,
			ol.address_line_1,
			ol.city,
			ol.state_or_region,
			ol.postal_code,
			ST_Y(ol.coordinates) AS latitude,
			ST_X(ol.coordinates) AS longitude
		 FROM universe.list_entry le
		 JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
		 LEFT JOIN universe.org_location ol
			ON le.record_source = 'org_location' AND ol.id = le.record_id
		 WHERE le.list_id = $1
		 ORDER BY ol.city, ol.name`,
		[listId, orgId]
	);

	const turfsResult = await client.query<{ id: string; code: string; bounds: string | null }>(
		`SELECT id, code, ST_AsGeoJSON(bounds)::text AS bounds
		 FROM universe.turf
		 WHERE list_id = $1 AND org_id = $2
		 ORDER BY code`,
		[listId, orgId]
	);

	// Current versions only, matching the turf page. This breaks the rule that
	// turfs stay locked to the versions they were cut with; #188 changes it to
	// read the referenced version as-is.
	const turfLocationsResult = await client.query<LocationRow & { turf_id: string }>(
		`SELECT
			tl.turf_id,
			ol.name,
			ol.address_line_1,
			ol.city,
			ol.state_or_region,
			ol.postal_code,
			ST_Y(ol.coordinates) AS latitude,
			ST_X(ol.coordinates) AS longitude
		 FROM universe.turf_location tl
		 JOIN universe.org_location ol ON tl.org_location_id = ol.id
		 WHERE tl.turf_id = ANY($1) AND tl.org_id = $2
		   AND ol.valid_to IS NULL
		 ORDER BY ol.name`,
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
