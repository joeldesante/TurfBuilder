import type { HandleClientError } from '@sveltejs/kit';
import { captureException } from '$lib/client/analytics';

// Does nothing unless analytics is turned on in the infra dashboard.
export const handleError: HandleClientError = ({ error, status, message }) => {
	captureException(error, { status });
	return { message };
};
