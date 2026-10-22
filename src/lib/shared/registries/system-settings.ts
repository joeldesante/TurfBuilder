import { z } from 'zod';

/**
 * Every system setting the infra panel edits. The settings page draws its
 * tabs and fields from this list, and the settings endpoint validates against
 * it, so a setting is added in one place. Values are stored as text in
 * `system_setting`; each validator checks that text.
 */

export type SettingGroup =
	| 'general'
	| 'organizations'
	| 'appearance'
	| 'email'
	| 'storage'
	| 'activity'
	| 'analytics'
	| 'telemetry'
	| 'links';

export type SettingInput =
	| { kind: 'text'; placeholder?: string }
	| { kind: 'url-list' }
	| { kind: 'boolean' }
	| { kind: 'select'; options: { value: string; label: string }[] }
	| { kind: 'html' }
	| { kind: 'number'; min?: number; max?: number; unit?: string }
	| { kind: 'url'; placeholder?: string }
	| { kind: 'links' };

export interface SettingDefinition {
	key: string;
	group: SettingGroup;
	label: string;
	help: string;
	input: SettingInput;
	/** Stored when the key is missing. */
	defaultValue: string;
	schema: z.ZodType<string>;
	/** Saving it takes effect only after the app restarts. */
	requiresRestart?: boolean;
}

export const SETTING_GROUPS: { id: SettingGroup; label: string; description: string }[] = [
	{ id: 'general', label: 'General', description: 'The name and addresses of this instance.' },
	{ id: 'organizations', label: 'Organizations', description: 'Who can create organizations.' },
	{ id: 'appearance', label: 'Appearance', description: 'What every page carries.' },
	{ id: 'email', label: 'Email', description: 'How outgoing mail is sent.' },
	{ id: 'storage', label: 'Storage', description: 'Where photos and generated PDFs are kept.' },
	{ id: 'activity', label: 'Activity', description: 'How long activity history is kept.' },
	{
		id: 'analytics',
		label: 'Analytics',
		description:
			'Product analytics. Off by default. Only ids and counts are sent: no names, emails, page text, or URLs with values.'
	},
	{
		id: 'telemetry',
		label: 'Telemetry',
		description: 'Where traces and server logs are exported over OpenTelemetry (OTLP). Empty turns each one off.'
	},
	{ id: 'links', label: 'External tools', description: 'Links to tools outside the app, shown in the infra menus.' }
];

const httpUrl = z
	.string()
	.trim()
	.refine((value) => {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}, 'Enter a full http or https address.');

const optionalUrl = z.union([z.literal(''), httpUrl]);

const booleanText = z.enum(['true', 'false'], 'Choose on or off.');

export const externalLinkSchema = z.object({
	label: z.string().trim().min(1, 'Every link needs a label.').max(60),
	url: httpUrl
});

const linksText = z.string().refine((value) => {
	try {
		return z.array(externalLinkSchema).max(20).safeParse(JSON.parse(value)).success;
	} catch {
		return false;
	}
}, 'Each link needs a label and a full http or https address.');

export const SYSTEM_SETTINGS: SettingDefinition[] = [
	{
		key: 'application_name',
		group: 'general',
		label: 'Application name',
		help: 'Shown in page titles, emails, and the sidebar.',
		input: { kind: 'text', placeholder: 'TurfBuilder' },
		defaultValue: 'TurfBuilder',
		schema: z.string().trim().min(1, 'The application needs a name.').max(80)
	},
	{
		key: 'base_url',
		group: 'general',
		label: 'Public addresses',
		help: 'The URLs people reach this instance at, one per line. Sign-in only works from these. The first is used in emails.',
		input: { kind: 'url-list' },
		defaultValue: 'http://localhost:5173',
		schema: z
			.string()
			.refine(
				(value) => {
					const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
					return lines.length > 0 && lines.every((line) => httpUrl.safeParse(line).success);
				},
				'Enter at least one full http or https address, one per line.'
			)
			.transform((value) => value.split('\n').map((line) => line.trim()).filter(Boolean).join('\n')),
		requiresRestart: true
	},
	{
		key: 'organizations.allow_creation',
		group: 'organizations',
		label: 'Anyone can create an organization',
		help: 'When off, only existing organizations can be used.',
		input: { kind: 'boolean' },
		defaultValue: 'true',
		schema: booleanText
	},
	{
		key: 'html.header_content',
		group: 'appearance',
		label: 'Page header HTML',
		help: 'Raw HTML added to the head of every page, such as an analytics script. It runs on every page, so only paste code you trust.',
		input: { kind: 'html' },
		defaultValue: '',
		schema: z.string().max(20_000)
	},
	{
		key: 'errors.cat_gifs',
		group: 'appearance',
		label: 'Cat on error pages',
		help: 'Shows a cat gif on error pages.',
		input: { kind: 'boolean' },
		defaultValue: 'true',
		schema: booleanText
	},
	{
		key: 'mail.transport',
		group: 'email',
		label: 'Transport',
		help: 'Direct delivers from this server. Amazon SES reads its credentials from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
		input: {
			kind: 'select',
			options: [
				{ value: 'direct', label: 'Direct' },
				{ value: 'ses', label: 'Amazon SES' }
			]
		},
		defaultValue: 'direct',
		schema: z.enum(['direct', 'ses'], 'Choose a transport.')
	},
	{
		key: 'mail.domain',
		group: 'email',
		label: 'Sending domain',
		help: 'Mail is sent from no-reply at this domain. Empty turns outgoing mail off.',
		input: { kind: 'text', placeholder: 'mail.example.com' },
		defaultValue: '',
		schema: z.union([
			z.literal(''),
			z
				.string()
				.trim()
				.regex(/^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i, 'Enter a domain such as mail.example.com.')
		])
	},
	{
		key: 'mail.ses.region',
		group: 'email',
		label: 'SES region',
		help: 'Only used with Amazon SES.',
		input: { kind: 'text', placeholder: 'us-east-1' },
		defaultValue: '',
		schema: z.union([z.literal(''), z.string().trim().regex(/^[a-z]{2}-[a-z]+-\d$/, 'Enter a region such as us-east-1.')])
	},
	{
		key: 'spaces.endpoint',
		group: 'storage',
		label: 'Endpoint',
		help: 'The object storage endpoint. Keys come from SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY.',
		input: { kind: 'url', placeholder: 'https://nyc3.digitaloceanspaces.com' },
		defaultValue: '',
		schema: optionalUrl
	},
	{
		key: 'spaces.region',
		group: 'storage',
		label: 'Region',
		help: 'Empty means us-east-1.',
		input: { kind: 'text', placeholder: 'nyc3' },
		defaultValue: '',
		schema: z.string().trim().max(40)
	},
	{
		key: 'spaces.bucket',
		group: 'storage',
		label: 'Bucket',
		help: 'Where location photos and generated PDFs are stored.',
		input: { kind: 'text' },
		defaultValue: '',
		schema: z.union([z.literal(''), z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Enter a valid bucket name.')])
	},
	{
		key: 'activity.retention_days',
		group: 'activity',
		label: 'Keep activity for',
		help: 'Activity history and the email log older than this are removed when migrations run, and not copied in again. 0 keeps everything.',
		input: { kind: 'number', min: 0, max: 36500, unit: 'days' },
		defaultValue: '730',
		schema: z
			.string()
			.trim()
			.regex(/^\d+$/, 'Enter a whole number of days.')
			.refine((value) => Number(value) <= 36500, 'Enter 36500 days or fewer.')
	},
	{
		key: 'analytics.provider',
		group: 'analytics',
		label: 'Provider',
		help: 'Where product analytics are sent. Off sends nothing and loads no analytics code.',
		input: {
			kind: 'select',
			options: [
				{ value: 'none', label: 'Off' },
				{ value: 'posthog', label: 'PostHog' }
			]
		},
		defaultValue: 'none',
		schema: z.enum(['none', 'posthog'], 'Choose a provider.')
	},
	{
		key: 'analytics.posthog.host',
		group: 'analytics',
		label: 'PostHog host',
		help: 'The PostHog ingestion address, such as https://us.i.posthog.com, or your own instance.',
		input: { kind: 'url', placeholder: 'https://us.i.posthog.com' },
		defaultValue: '',
		schema: optionalUrl
	},
	{
		key: 'analytics.posthog.token',
		group: 'analytics',
		label: 'PostHog project token',
		help: 'The project API key, starting with phc_. It is public: browsers receive it to send events.',
		input: { kind: 'text', placeholder: 'phc_...' },
		defaultValue: '',
		schema: z.union([
			z.literal(''),
			z.string().trim().regex(/^phc_[A-Za-z0-9_-]+$/, 'Enter a project token starting with phc_.')
		])
	},
	{
		key: 'telemetry.traces_endpoint',
		group: 'telemetry',
		label: 'Traces endpoint',
		help: 'OTLP over HTTP, such as http://jaeger:4318/v1/traces. Auth headers, if the backend needs them, come from OTEL_EXPORTER_OTLP_TRACES_HEADERS. Empty turns tracing off.',
		input: { kind: 'url', placeholder: 'http://jaeger:4318/v1/traces' },
		defaultValue: '',
		schema: optionalUrl
	},
	{
		key: 'telemetry.logs_endpoint',
		group: 'telemetry',
		label: 'Logs endpoint',
		help: 'OTLP over HTTP. For PostHog Logs use https://us.i.posthog.com/i/v1/logs and set OTEL_EXPORTER_OTLP_LOGS_HEADERS to Authorization=Bearer followed by your project token. Other backends take their auth from the same variable. Logs still go to stdout either way. Empty turns export off.',
		input: { kind: 'url', placeholder: 'https://otlp.example.com/v1/logs' },
		defaultValue: '',
		schema: optionalUrl
	},
	{
		key: 'links.analytics_url',
		group: 'links',
		label: 'Analytics',
		help: 'The analytics dashboard, such as your PostHog project. Empty hides the link.',
		input: { kind: 'url', placeholder: 'https://analytics.example.com' },
		defaultValue: 'https://analytics.turfbuilder.org',
		schema: optionalUrl
	},
	{
		key: 'links.tracing_url',
		group: 'links',
		label: 'Tracing',
		help: 'The tracing UI, such as Jaeger. Keep it behind access control; Jaeger has no sign-in of its own. Empty hides the link.',
		input: { kind: 'url', placeholder: 'http://localhost:16686' },
		defaultValue: '',
		schema: optionalUrl
	},
	{
		key: 'links.custom',
		group: 'links',
		label: 'More links',
		help: 'Other tools, such as a metrics dashboard or the hosting console.',
		input: { kind: 'links' },
		defaultValue: '[]',
		schema: linksText
	}
];

export const SETTINGS_BY_KEY = new Map(SYSTEM_SETTINGS.map((setting) => [setting.key, setting]));

/**
 * The PATCH body: any subset of registered keys. Each value is checked by its
 * own definition, and unknown keys are rejected rather than ignored.
 */
export function parseSettingsUpdate(
	body: unknown
): { success: true; data: Record<string, string> } | { success: false; errors: Record<string, string> } {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { success: false, errors: { _: 'Send an object of setting keys and values.' } };
	}

	const data: Record<string, string> = {};
	const errors: Record<string, string> = {};
	for (const [key, value] of Object.entries(body)) {
		const definition = SETTINGS_BY_KEY.get(key);
		if (!definition) {
			errors[key] = 'Unknown setting.';
			continue;
		}
		const parsed = definition.schema.safeParse(value);
		if (parsed.success) data[key] = parsed.data;
		else errors[key] = parsed.error.issues[0]?.message ?? 'Invalid value.';
	}

	if (Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
		return { success: false, errors: { _: 'Nothing to save.' } };
	}
	return Object.keys(errors).length ? { success: false, errors } : { success: true, data };
}
