import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		SvelteKitPWA({ 
			registerType: 'autoUpdate',
			pwaAssets: {
				disabled: true
			},
			manifest: {
				name: 'TurfBuilder',
				short_name: 'TurfBuilder',
				description: 'Grassroots canvassing for all!',
				theme_color: '#36a263',
				background_color: '#36a263',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{
						"src": "pwa-64x64.png",
						"sizes": "64x64",
						"type": "image/png"
					},
					{
						"src": "pwa-192x192.png",
						"sizes": "192x192",
						"type": "image/png"
					},
					{
						"src": "pwa-512x512.png",
						"sizes": "512x512",
						"type": "image/png"
					},
					{
						"src": "maskable-icon-512x512.png",
						"sizes": "512x512",
						"type": "image/png",
						"purpose": "maskable"
					}
				]
			},
			includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon*.png'],
		}),
		svelteTesting()
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
