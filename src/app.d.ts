// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@sveltejs/kit" />
/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/client" />

import type { Session, User } from "better-auth";
import { ApplicationConfig } from "./config";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: Session;
			user?: User;
			config: ApplicationConfig
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};