// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';
import dbAccessBaseline from './eslint.db-access-baseline.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['tools/**'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		// Only services touch the database. Routes, hooks, plugins, pages and
		// browser code call a service in $lib/server/services, which checks
		// access, opens the transaction and hides the tables, so storage can
		// change without touching callers. contacts and addresses are internal
		// building blocks for other services and take a client, so they are off
		// limits here too. Files not yet moved are listed in the baseline.
		files: [
			'src/routes/**',
			'src/hooks.server.ts',
			'src/plugins/**',
			'src/stories/**',
			'src/lib/client/**'
		],
		// Route paths contain [param] segments, which are glob character
		// classes; escape them so each baseline entry matches its file literally.
		ignores: ['**/*.spec.ts', ...dbAccessBaseline.map((p) => p.replace(/[[\]]/g, '\\$&'))],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [{ name: 'pg', message: 'Call a service in $lib/server/services instead.' }],
					patterns: [
						{
							group: [
								'$lib/server/database',
								'$lib/server/database.*',
								'$lib/server/services/contacts.service*',
								'$lib/server/services/addresses.service*'
							],
							message:
								'Only services touch the database. Call a service in $lib/server/services instead.'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
