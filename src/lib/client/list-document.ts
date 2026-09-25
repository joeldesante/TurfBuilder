interface ListDocument {
	id: string;
	status: 'pending' | 'ready' | 'failed';
	error: string | null;
	created_at: string;
	download_url?: string | null;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 2 * 60_000;

/**
 * A pending document older than this is treated as abandoned. Generation runs
 * in the server process, so a restart mid-render leaves the row pending forever.
 */
const STALE_PENDING_MS = 5 * 60_000;

/**
 * Fetches JSON, turning every failure into a message fit to show the user.
 * The document routes write their 4xx messages for people; a 5xx or a network
 * failure could say anything, so those get generic wording instead.
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch {
		throw new Error('Could not reach the server. Check your connection and try again.');
	}
	if (!res.ok) {
		if (res.status >= 500) throw new Error('Something went wrong on the server. Try again shortly.');
		const body = await res.json().catch(() => null);
		throw new Error(body?.message ?? 'The request could not be completed.');
	}
	return res.json();
}

/**
 * Starts generating a PDF. Sends the browser's timezone so times print as the
 * requester reads them, until organizations have their own timezone setting
 * (#183).
 */
function create(base: string): Promise<ListDocument> {
	return request<ListDocument>(base, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
	});
}

/**
 * Downloads the list's PDF. Reuses a ready one, or joins one already being
 * generated, and otherwise starts a new one. Calls `onGenerating` if it has to
 * wait for generation, so the caller can say so.
 */
export async function downloadListDocument(
	orgId: string,
	listId: string,
	onGenerating: () => void
): Promise<void> {
	const base = `/api/v1/organizations/${orgId}/lists/${listId}/documents`;

	const documents = await request<ListDocument[]>(base);
	const existing =
		documents.find((d) => d.status === 'ready') ??
		documents.find(
			(d) => d.status === 'pending' && Date.now() - Date.parse(d.created_at) < STALE_PENDING_MS
		);
	const { id } = existing ?? (await create(base));

	await waitAndDownload(base, id, onGenerating);
}

/**
 * Generates a fresh PDF for the list and downloads it once ready. The server
 * soft-deletes the list's previous PDFs when the new one is created, and
 * restores them if the new one fails.
 */
export async function regenerateListDocument(
	orgId: string,
	listId: string,
	onGenerating: () => void
): Promise<void> {
	const base = `/api/v1/organizations/${orgId}/lists/${listId}/documents`;
	const { id } = await create(base);
	await waitAndDownload(base, id, onGenerating);
}

async function waitAndDownload(base: string, id: string, onGenerating: () => void): Promise<void> {
	let document = await request<ListDocument>(`${base}/${id}`);
	if (document.status === 'pending') onGenerating();

	const deadline = Date.now() + POLL_TIMEOUT_MS;
	while (document.status === 'pending') {
		if (Date.now() > deadline) throw new Error('The PDF is taking too long. Try again shortly.');
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
		document = await request<ListDocument>(`${base}/${id}`);
	}

	if (document.status === 'failed' || !document.download_url) {
		throw new Error(document.error ?? 'The PDF could not be generated.');
	}

	// The link is served as an attachment, so this downloads without leaving the page.
	window.location.assign(document.download_url);
}
