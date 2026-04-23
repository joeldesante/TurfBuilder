// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@sveltejs/kit" />
/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/client" />

import type { Session, User } from 'better-auth';
import type { AppSettings } from '$lib/server/settings';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: Session;
			user?: User;
			/** Null on /setup and /auth routes before settings have been configured. */
			config?: AppSettings;
			organization?: {
				id: string;
				name: string;
				slug: string;
				permissions: string[];
				role?: {
					id: string;
					name: string;
				};
			};
			infrastructure?: {
				permissions: string[]
			}
		}
		interface PageData {
			config?: AppSettings;
			organization?: {
				id: string;
				name: string;
				slug: string;
				role?: {
					id: string;
					name: string;
				};
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
