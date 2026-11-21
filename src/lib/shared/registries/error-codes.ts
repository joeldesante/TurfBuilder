/**
 * Fatal errors the server answers with its own page, before the app can
 * render. The message is shown to whoever opens the site, so it says what to
 * do and never what went wrong inside.
 */
export const ERROR_CODES = {
	APP_NOT_MIGRATED: {
		status: 503,
		message: 'TurfBuilder has connected to the database, but it has not yet been initialized propperly.'
	},
	APP_NOT_SET_UP: {
		status: 503,
		message: 'TurfBuilder has connected to the database, but the application is not yet setup.'
	},
	DATABASE_UNREACHABLE: {
		status: 503,
		message: 'Could not connect to the database.'
	},
	MAINTENANCE: {
		status: 503,
		message: 'TurfBuilder is down for scheduled maintenance. Please check back soon.'
	}
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
