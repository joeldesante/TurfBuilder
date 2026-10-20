/** One activity event as the infra feeds show it. */
export interface ActivityEntry {
	id: string;
	type: string;
	label: string;
	userId: string | null;
	userName: string | null;
	orgId: string | null;
	orgName: string | null;
	metadata: Record<string, unknown>;
	occurredAt: string;
}

/** One row of the email log. */
export interface EmailLogEntry {
	id: string;
	recipient: string;
	template: string;
	subject: string | null;
	status: 'sent' | 'skipped' | 'failed';
	error: string | null;
	createdAt: string;
}

export interface EmailLogFilters {
	status?: EmailLogEntry['status'];
	template?: string;
	recipient?: string;
}
