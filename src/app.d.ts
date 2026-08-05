// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@sveltejs/kit" />
/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/client" />

import type { Settings } from '$lib/server/services/settings.service';
import type { Session, User } from 'better-auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: Session;
			user?: User;
			settings?: Settings;
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
