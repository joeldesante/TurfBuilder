/**
 * Masking for text that leaves the app (logs, analytics). Error messages from
 * drivers and libraries often quote the value that failed, such as
 * invalid input syntax for type uuid: "abc" or Invalid recipient jane@x.org.
 * Shared so the server logger and the browser analytics scrub the same way.
 */

const EMAIL = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[^\s@"'<>()]+/g;
// Constraint and column names stay available in dedicated fields where they matter.
const QUOTED = /(["'`])(?:(?!\1).)*\1/g;

/** Masks emails and quoted values in a message. */
export function scrubMessage(message: string): string {
	return message.replace(EMAIL, '[email]').replace(QUOTED, '$1?$1');
}
