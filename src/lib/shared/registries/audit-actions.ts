/** How the audit log names each action an infra admin can take. */
export const AUDIT_ACTIONS: Record<string, string> = {
	'user.update': 'Edited a user',
	'user.suspend': 'Suspended a user',
	'user.unsuspend': 'Lifted a suspension',
	'user.delete': 'Deleted a user',
	'user.sessions.revoke': 'Signed a user out everywhere',
	'user.session.revoke': 'Ended a session',
	'user.password_reset.send': 'Sent a password reset',
	'user.verification.send': 'Sent a verification email',
	'user.two_factor.reset': 'Turned off two-factor sign-in',
	'user.impersonate.start': 'Started impersonating',
	'user.impersonate.stop': 'Stopped impersonating',
	'impersonation.request': 'Made a change while impersonating',
	'infra_role.grant': 'Granted an infrastructure role',
	'infra_role.revoke': 'Removed an infrastructure role',
	'org.suspend': 'Suspended an organization',
	'org.unsuspend': 'Lifted an organization suspension',
	'org.delete': 'Deleted an organization',
	'org.restore': 'Restored an organization',
	'org.ownership.transfer': 'Transferred ownership',
	'org.member.remove': 'Removed a member',
	'org.invitation.cancel': 'Canceled an invitation',
	'org.invite_link.revoke': 'Revoked an invite link',
	'settings.update': 'Changed settings',
	'email_template.update': 'Edited an email template',
	'email_template.reset': 'Reset an email template',
	'email_template.test': 'Sent a test email',
	'mail.test': 'Sent a test email',
	'storage.test': 'Tested storage'
};

export function auditActionLabel(action: string): string {
	return AUDIT_ACTIONS[action] ?? action;
}
