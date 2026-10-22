/**
 * A failed /api/v1 request. The message is always safe to show the user: v2
 * writes its 4xx messages for people, and a 5xx or a network failure could say
 * anything, so those get generic wording instead.
 */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		/** Problems by field, when the server names them (settings validation). */
		readonly errors?: Record<string, string>
	) {
		super(message);
	}
}

/** Fetches a /api/v1 endpoint and returns its JSON, throwing ApiError on failure. */
export async function api<T = unknown>(
	path: string,
	init: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
	const { body, headers, ...rest } = init;

	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			...rest,
			headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
	}

	if (!res.ok) {
		if (res.status >= 500) throw new ApiError('Something went wrong on the server. Try again shortly.', res.status);
		const payload = await res.json().catch(() => null);
		throw new ApiError(payload?.message ?? 'The request could not be completed.', res.status, payload?.errors);
	}

	if (res.status === 204) return undefined as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : undefined) as T;
}

/** A user-safe message for any error thrown by `api()` or elsewhere. */
export function errorMessage(e: unknown, fallback = 'The request could not be completed.'): string {
	return e instanceof ApiError ? e.message : fallback;
}
