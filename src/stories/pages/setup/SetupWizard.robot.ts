import type { AmazonSESConfig, Settings } from "$lib/server/services/settings.service";
import { createMachine, state, reduce, transition, type Transition } from "robot3";
import { z } from "zod";

function createInitialState(initialState: Settings): Settings {
	return {
		applicationName: "TurfBuilder",
		baseURLs: [],
		trustedOrigins: [],
		services: {
			overture: {
				enabled: false,
				natsHost: "",
				natsPort: 4222,
				apiPort: 0
			},
			email: {
				transport: "ses",
				domain: "",
				other: undefined
			}
		},
		technical: {
			head: "",
			catGifs: true,
			tenateMode: "single",
			telemetry: false
		},
		organizations: {
			allowCreation: true
		}
	}
}

export const machine = createMachine('checkDatabaseConnection', {
	checkDatabaseConnection: state<Transition<'success' | 'failed'>>(
		transition('success', 'initializeDatabase'),
		transition('failed', 'databaseError'),
	),
	initializeDatabase: state<Transition<'success' | 'failed'>>(
		transition('success', 'confirmTelemetry'),
		transition('failed', 'databaseError'),
	),
	databaseError: state(),
	confirmTelemetry: state<Transition<'next'>>(
		transition('next', 'setURLs', reduce((state: Settings, ev: Telemetry) => ({ ...state, technical: { ...state.technical, telemetry: ev.telemetry } }))),
	),
	setURLs: state<Transition<'next'>>(
		transition('next', 'tenateMode', reduce((state: Settings, ev: URLs) => ({ ...state, baseURLs: ev.urls, trustedOrigins: ev.urls }))),
	),
	tenateMode: state<Transition<'single' | 'multi'>>(
		transition('single', 'services', reduce((state: Settings): Settings => ({ ...state, technical: { ...state.technical, tenateMode: 'single' }, organizations: { ...state.organizations, allowCreation: false } }))),
		transition('multi', 'orgSettings', reduce((state: Settings): Settings => ({ ...state, technical: { ...state.technical, tenateMode: 'multi' }}))),
	),
	orgSettings: state<Transition<'next'>>(
		transition('next', 'services', reduce((state: Settings, ev: OrgSettings) => ({ ...state, organizations: { ...state.organizations, allowCreation: ev.canCreateNewOrgs } }))),
	),
	services: state<Transition<'next'>>(
		transition('next', 'theme', reduce((state: Settings, ev: Services): Settings => ({ ...state, services: {
			overture: {
				natsHost: ev.overture.natsHost,
				natsPort: ev.overture.natsPort,
				apiPort: ev.overture.apiPort,
				enabled: ev.overture.enabled
			},
			email: {
				transport: ev.email.transport,
				domain: ev.email.domain,
				other: ev.email.other
			}
		}})))
	),
	theme: state<Transition<'next'>>(
		transition('next', 'done', reduce((state: Settings, ev: Theme): Settings => (
			{
				...state,
				applicationName: ev.applicationName,
				technical: {
					...state.technical,
					catGifs: ev.catGifs
				}
			}
		)))
	),
	done: state()
}, createInitialState);

export const TelemetrySchema = z.object({
	telemetry: z.boolean()
});

export const URLsSchema = z.object({
	urls: z
		.array(z.string())
		.min(1, 'At least one URL is required')
		.refine((urls) => urls.every((url) => z.url().safeParse(url).success), 'All entries must be valid URLs')
});

export const OrgSettingsSchema = z.object({
	canCreateNewOrgs: z.boolean()
});

export const ServicesSchema = z.object({
	overture: z.object({
		enabled: z.boolean(),
		natsHost: z.string(),
		natsPort: z.number(),
		apiPort: z.number()
	}).superRefine((overture, ctx) => {
		// Connection settings are hidden and unused unless the service is enabled.
		if (!overture.enabled) return;
		if (overture.natsHost.trim() === '') {
			ctx.addIssue({ code: 'custom', path: ['natsHost'], message: 'NATS host is required' });
		}
		if (!Number.isInteger(overture.natsPort) || overture.natsPort < 1 || overture.natsPort > 65535) {
			ctx.addIssue({ code: 'custom', path: ['natsPort'], message: 'Port must be between 1 and 65535' });
		}
		if (!Number.isInteger(overture.apiPort) || overture.apiPort < 1 || overture.apiPort > 65535) {
			ctx.addIssue({ code: 'custom', path: ['apiPort'], message: 'Port must be between 1 and 65535' });
		}
	}),
	email: z.object({
		transport: z.enum(['ses', 'direct']),
		domain: z.string().min(1, 'Domain is required'),
		other: z.custom<AmazonSESConfig>().optional()
	}).superRefine((email, ctx) => {
		// SES settings are hidden and unused unless the SES transport is selected.
		if (email.transport !== 'ses') return;
		if (!email.other || email.other.region.trim() === '') {
			ctx.addIssue({ code: 'custom', path: ['other', 'region'], message: 'SES region is required' });
		}
	})
});

export const ThemeSchema = z.object({
	catGifs: z.boolean(),
	applicationName: z.string().min(1, 'Application name is required')
});

type Telemetry = z.infer<typeof TelemetrySchema>;
type URLs = z.infer<typeof URLsSchema>;
type OrgSettings = z.infer<typeof OrgSettingsSchema>;
type Services = z.infer<typeof ServicesSchema>;
type Theme = z.infer<typeof ThemeSchema>;