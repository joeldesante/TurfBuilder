/**
 * A product analytics backend. Implementations must never throw from capture
 * calls and must batch: callers fire and forget inside request handlers.
 */
export interface AnalyticsProvider {
	capture(distinctId: string, event: string, properties?: Record<string, unknown>): void;
	captureException(error: Error, distinctId?: string, properties?: Record<string, unknown>): void;
	/** Sends anything still queued, then stops. */
	shutdown(): Promise<void>;
}
