/** A user as the infra users list shows them. Dates are ISO strings. */
export interface PlatformUserRow {
	id: string;
	name: string;
	email: string;
	username: string;
	image: string | null;
	emailVerified: boolean;
	twoFactorEnabled: boolean;
	/** Suspended now: banned with no expiry, or an expiry still ahead. */
	suspended: boolean;
	createdAt: string;
	/** The last day the user used the app (YYYY-MM-DD), or null if never recorded. */
	lastActiveDay: string | null;
	orgCount: number;
	isInfraAdmin: boolean;
}

export interface PlatformUserDetail extends PlatformUserRow {
	displayUsername: string;
	updatedAt: string;
	suspendedReason: string | null;
	/** When the suspension ends; null for one with no end, or when not suspended. */
	suspendedUntil: string | null;
	/** Ways the user can sign in, such as "credential" for email and password. */
	signInMethods: { providerId: string; createdAt: string }[];
	infraRoles: { id: string; name: string }[];
	activeSessionCount: number;
	/** Whether this was deleted (anonymized) by an admin. */
	deleted: boolean;
}

export interface UserMembership {
	memberId: string;
	organizationId: string;
	name: string;
	slug: string;
	/** better-auth's member role: owner, admin, or member. */
	memberRole: string;
	/** The highest-priority app role in the org, such as Administrator. */
	roleName: string | null;
	joinedAt: string;
	lastActiveDay: string | null;
	suspended: boolean;
	deleted: boolean;
}

export interface UserSession {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
	updatedAt: string;
	expiresAt: string;
	/** Set when an infra admin started this session to impersonate the user. */
	impersonatedBy: { id: string; name: string } | null;
}

export type UserStatusFilter =
	| 'all'
	| 'unverified'
	| 'suspended'
	| 'two_factor'
	| 'infra_admin'
	| 'no_orgs'
	| 'never_active';

export type UserSort = 'newest' | 'oldest' | 'recently_active' | 'name';

export interface UserFilters {
	q?: string;
	status?: UserStatusFilter;
	sort?: UserSort;
}
