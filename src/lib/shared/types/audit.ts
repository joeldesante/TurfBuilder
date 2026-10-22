/** What an infra admin action was taken on. */
export type AuditTargetType = 'user' | 'organization' | 'session' | 'setting' | 'email_template' | 'infra_role' | 'system';

export interface AuditTarget {
	type: AuditTargetType;
	id?: string | null;
}

/** One row of the infra audit log, with the actor's name for display. */
export interface AuditEntry {
	id: string;
	actorId: string | null;
	actorName: string | null;
	actorEmail: string | null;
	action: string;
	targetType: AuditTargetType;
	targetId: string | null;
	metadata: Record<string, unknown>;
	ip: string | null;
	userAgent: string | null;
	createdAt: string;
}

export interface AuditFilters {
	actorId?: string;
	action?: string;
	targetType?: AuditTargetType;
	targetId?: string;
	/** ISO dates, inclusive. */
	from?: string;
	to?: string;
}
