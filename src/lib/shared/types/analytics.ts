/** What the browser needs to start analytics; null when analytics is off. */
export interface ClientAnalyticsConfig {
	provider: 'posthog';
	host: string;
	/** The provider's public project key. Safe to send to browsers. */
	token: string;
}
