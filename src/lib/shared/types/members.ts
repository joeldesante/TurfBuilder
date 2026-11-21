/** A token invite link: anyone with `/invite/{id}` can join until it expires. */
export interface InviteLink {
	id: string;
	created_at: string;
	expires_at: string | null;
}

/** An organization's invite links and whether its open slug invite is on. */
export interface InviteSettings {
	links: InviteLink[];
	slugInviteEnabled: boolean;
}

/** One organization permission as the member detail page shows it, with the member's override. */
export interface MemberPermission {
	id: string;
	key: string;
	label: string;
	group: string;
	description: string | null;
	/** true grants, false denies, null follows the member's roles. */
	value: boolean | null;
}

/** What the member detail page shows. */
export interface MemberDetail {
	member_id: string;
	user: { id: string; name: string; email: string };
	permissions: MemberPermission[];
}
