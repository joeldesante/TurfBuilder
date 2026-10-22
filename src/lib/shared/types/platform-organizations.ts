/** An organization as the infra list shows it. Dates are ISO strings. */
export interface PlatformOrgRow {
	id: string;
	name: string;
	slug: string;
	createdAt: string;
	memberCount: number;
	pendingInvitations: number;
	/** An owner, for the list; an org can have several. */
	owner: { id: string; name: string } | null;
	/** The last day any member used the org (YYYY-MM-DD), or null. */
	lastActiveDay: string | null;
	/** Activity events in the org over the last 30 days. */
	events30d: number;
	suspended: boolean;
	deleted: boolean;
}

export interface OrgCounts {
	members: number;
	activeMembers30d: number;
	records: number;
	buckets: number;
	lists: number;
	turfs: number;
	surveys: number;
	visits: number;
	visits30d: number;
	conversations: number;
	documents: number;
}

export interface PlatformOrgDetail extends PlatformOrgRow {
	suspendedAt: string | null;
	suspendedReason: string | null;
	deletedAt: string | null;
	/** Owners and members with the Administrator role: who runs it. */
	leaders: { userId: string; name: string; email: string; owner: boolean; roleName: string | null }[];
	createdBy: { id: string; name: string } | null;
	plugins: { slug: string; enabled: boolean; installedAt: string }[];
	counts: OrgCounts;
	/** How many members were active in the last 30 days, before that, or never. */
	memberActivity: { active: number; dormant: number; never: number };
}

export interface OrgMember {
	memberId: string;
	userId: string;
	name: string;
	email: string;
	/** better-auth's member role: owner, admin, or member. */
	memberRole: string;
	roleName: string | null;
	joinedAt: string;
	lastActiveDay: string | null;
}

export interface OrgInvitation {
	id: string;
	email: string;
	role: string | null;
	status: string;
	inviterName: string | null;
	createdAt: string;
}

export interface OrgInviteLink {
	id: string;
	createdBy: string | null;
	createdAt: string;
	expiresAt: string | null;
}

export type OrgStatusFilter = 'all' | 'active' | 'inactive' | 'suspended' | 'deleted';
export type OrgSort = 'newest' | 'oldest' | 'members' | 'recently_active' | 'name';

export interface OrgFilters {
	q?: string;
	status?: OrgStatusFilter;
	sort?: OrgSort;
}
