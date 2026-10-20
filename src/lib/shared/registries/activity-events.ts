/**
 * Every kind of row in `activity_event`. The type is the stored string; label
 * is how the infra pages name it.
 */
export const ACTIVITY_EVENTS = {
	'user.signed_up': { label: 'Signed up' },
	'user.signed_in': { label: 'Signed in' },
	'user.password_reset': { label: 'Reset their password' },
	'org.created': { label: 'Created an organization' },
	'member.joined': { label: 'Joined an organization' },
	'member.left': { label: 'Left an organization' },
	'canvass.visit': { label: 'Visited a location' },
	'survey.submitted': { label: 'Submitted a survey' },
	'list.created': { label: 'Created a list' },
	'turf.created': { label: 'Cut a turf' },
	'document.generated': { label: 'Generated a list document' },
	'document.failed': { label: 'List document failed' }
} as const satisfies Record<string, { label: string }>;

export type ActivityEventType = keyof typeof ACTIVITY_EVENTS;

export const ACTIVITY_EVENT_TYPES = Object.keys(ACTIVITY_EVENTS) as ActivityEventType[];

export function activityEventLabel(type: string): string {
	return ACTIVITY_EVENTS[type as ActivityEventType]?.label ?? type;
}
