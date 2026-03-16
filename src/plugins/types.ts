import type { PoolClient } from 'pg';
import type { Component } from 'svelte';
import type { RequestEvent } from '@sveltejs/kit';
import type { SidebarNavEntry } from '$components/layout/sidebar/types';

export interface PluginContext {
	/** Execute queries within the org-scoped RLS transaction. Do not use POOL directly. */
	db: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
	orgId: string;
	userId: string;
	userRole: App.Locals['organization']['role'];
	config: Record<string, unknown>;
}

export interface PluginHooks {
	onTurfCreated?: (turf: { id: string; code: string }, ctx: PluginContext) => Promise<void>;
	onSurveySubmitted?: (
		attempt: { id: string; surveyId: string },
		ctx: PluginContext
	) => Promise<void>;
	onUserJoinedOrg?: (user: { id: string }, ctx: PluginContext) => Promise<void>;
}

export interface PluginManifest {
	slug: string;
	name: string;
	description: string;
	version: string;
	/** Permission required to see this plugin's nav entries. If omitted, all staff can see. */
	requiredPermission?: { resource: string; action: string };
	/** Nav entries injected into the staff sidebar when this plugin is active */
	navEntries?: (orgSlug: string) => SidebarNavEntry[];
	/** Svelte page components keyed by path segment. 'index' maps to the root plugin page */
	pages?: Record<string, Component<any>>;
	/** Volunteer-facing page components keyed by path segment. Served at /o/[org_slug]/plugins/[slug]/[...path] */
	volunteerPages?: Record<string, Component<any>>;
	/** Server-side data loader for plugin pages */
	serverLoad?: (
		path: string,
		event: RequestEvent
	) => Promise<Record<string, unknown>>;
	/** API route handlers — key format: 'METHOD:path' e.g. 'GET:status', 'POST:import' */
	apiHandlers?: Record<
		string,
		(event: RequestEvent, ctx: PluginContext) => Promise<Response>
	>;
	hooks?: PluginHooks;
	/** Optional Zod schema for the config JSONB column (used to render config form in UI) */
	configSchema?: import('zod').ZodObject<any>;
}
