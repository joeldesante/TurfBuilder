export interface InfraRole {
	id: string;
	name: string;
	/** Lower wins when two roles disagree about a permission. */
	weight: number;
	permissions: string[];
	holderCount: number;
}

export interface InfraAdmin {
	id: string;
	name: string;
	email: string;
	roles: { id: string; name: string; grantedAt: string; grantedBy: string | null }[];
	/** The permissions the user ends up with after roles and direct grants. */
	permissions: string[];
	/** Has `access` and `users.manage`, so counts toward the last-admin guard. */
	canManageAdmins: boolean;
}
