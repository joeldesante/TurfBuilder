// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@sveltejs/kit" />
/// <reference types="@vite-pwa/sveltekit" />

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: any;
			user?: any;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
