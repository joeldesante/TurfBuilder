import { error } from '@sveltejs/kit';

/** Throws 501. For service functions whose real implementation is still to be written. */
export function notImplemented(): never {
	throw error(501, 'Not implemented');
}
