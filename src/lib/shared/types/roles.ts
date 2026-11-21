/** A permission role in an organization, with the keys it grants. */
export interface Role {
	id: string;
	organization_id: string;
	name: string;
	is_default: boolean;
	/** Lower comes first; 0 is the administrator role, which always keeps `system.access`. */
	weight: number;
	permissions: string[];
}

/** A role as the member role picker lists it. */
export interface RoleOption {
	id: string;
	name: string;
}
