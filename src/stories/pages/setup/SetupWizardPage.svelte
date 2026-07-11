<script lang="ts">
	import { useMachine } from '@xstate/svelte';
	import { machine } from '$lib/machines/setup.machine';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	const { snapshot, send } = useMachine(machine);

	const stateValue = $derived($snapshot.value as string);

	type SetupEvent = Parameters<typeof send>[0];

	// Phase indicator — groups machine states into visible progress phases.
	const PHASES: { label: string; states: string[] }[] = [
		{
			label: 'Database',
			states: [
				'Confirm Database Connection',
				'Database Help',
				'Database Schema Setup',
				'Error Display'
			]
		},
		{ label: 'Hosts', states: ["Configure Base URL's"] },
		{ label: 'Email', states: ['Select Email Mode', 'Configure AWS SES', 'Configure Direct Send'] },
		{ label: 'Admin', states: ['Create Admin Account'] },
		{ label: 'Customize', states: ['Select Customizations', 'Select Map Tile Server'] },
		{
			label: 'Tenancy',
			states: [
				'Select Tenant Mode',
				'Single: Select Application Complexity',
				'Allow Anyone to Create an Org'
			]
		},
		{
			label: 'Overture',
			states: [
				'Select Overture Host',
				'ST: Connect TurfBuilder Infrastructure Account',
				'MT: Connect TurfBuilder Infrastructure Account',
				'Configure NATs URL for Overture'
			]
		},
		{ label: 'Done', states: ['Finished'] }
	];

	const phaseIndex = $derived(PHASES.findIndex((p) => p.states.includes(stateValue)));

	// Shared save helper — persists settings then advances the machine.
	let stepSaving = $state(false);
	let stepError = $state('');

	async function saveConfig(settings: Record<string, string>) {
		const res = await fetch('/setup/api/save-config', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ settings })
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message ?? 'Failed to save settings');
		}
	}

	async function saveAndSend(settings: Record<string, string>, event: SetupEvent) {
		stepSaving = true;
		stepError = '';
		try {
			await saveConfig(settings);
			send(event);
		} catch (e) {
			stepError = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			stepSaving = false;
		}
	}

	// ── Confirm Database Connection ─────────────────────────────────
	let dbStatus = $state<'idle' | 'checking' | 'ok'>('idle');
	let dbError = $state('');

	async function checkDb() {
		dbStatus = 'checking';
		dbError = '';
		try {
			const res = await fetch('/setup/api/check-db');
			const data = await res.json();
			if (data.ok) {
				dbStatus = 'ok';
			} else {
				dbStatus = 'idle';
				dbError = data.error ?? 'Connection failed';
				send({ type: 'DB_CONNECTION_FAILURE' });
			}
		} catch (e) {
			dbStatus = 'idle';
			dbError = String(e);
			send({ type: 'DB_CONNECTION_FAILURE' });
		}
	}

	// ── Database Schema Setup ───────────────────────────────────────
	type StepStatus = 'pending' | 'running' | 'done' | 'error';

	interface SchemaProgress {
		step: number;
		total: number;
		label: string;
		status: StepStatus;
		error?: string;
	}

	let schemaStarted = $state(false);
	let schemaComplete = $state(false);
	let schemaError = $state('');
	let progressItems = $state<SchemaProgress[]>([]);

	function resetSchemaState() {
		schemaStarted = false;
		schemaComplete = false;
		schemaError = '';
		progressItems = [];
	}

	async function createSchema() {
		schemaStarted = true;
		schemaError = '';
		progressItems = [];

		const res = await fetch('/setup/api/create-schema', { method: 'POST' });
		if (!res.body) {
			schemaError = 'No response body';
			send({ type: 'SCHEMA_SETUP_ERROR' });
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;
				const data = JSON.parse(line.slice(6));

				if (data.done) {
					schemaComplete = true;
					continue;
				}

				const existing = progressItems.findIndex((p) => p.step === data.step);
				if (existing >= 0) {
					progressItems[existing] = data as SchemaProgress;
				} else {
					progressItems = [...progressItems, data as SchemaProgress];
				}

				if (data.status === 'error') {
					schemaError = data.error ?? 'Unknown error';
					send({ type: 'SCHEMA_SETUP_ERROR' });
					return;
				}
			}
		}
	}

	let progressPercent = $derived(
		progressItems.length === 0
			? 0
			: Math.round(
					(progressItems.filter((p) => p.status === 'done').length /
						(progressItems[0]?.total ?? 1)) *
						100
				)
	);

	// ── Configure Base URL's ────────────────────────────────────────
	let hosts = $state<string[]>([typeof window !== 'undefined' ? window.location.origin : '']);

	async function saveHosts() {
		const trimmed = hosts.map((h) => h.trim()).filter(Boolean);
		if (trimmed.length === 0) {
			stepError = 'Enter at least one host URL.';
			return;
		}
		for (const host of trimmed) {
			try {
				new URL(host);
			} catch {
				stepError = `"${host}" is not a valid URL (include https://).`;
				return;
			}
		}
		await saveAndSend(
			{ base_url: trimmed[0], 'base_url.trusted_origins': JSON.stringify(trimmed) },
			{ type: 'NEXT' }
		);
	}

	// ── Select Email Mode ───────────────────────────────────────────
	let directSendWarningVisible = $state(false);

	// ── Configure AWS SES ───────────────────────────────────────────
	const sesSchema = z.object({
		mail_domain: z.string().min(1, 'Email domain is required'),
		ses_region: z.string().min(1, 'AWS region is required')
	});

	const sesForm = new Form(sesSchema, async (values) => {
		const res = await fetch('/setup/api/save-email-settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				mail_transport: 'ses',
				mail_domain: values.mail_domain,
				ses_region: values.ses_region
			})
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message ?? 'Failed to save email settings');
		}
		send({ type: 'NEXT' });
	});

	// ── Configure Direct Send ───────────────────────────────────────
	const directSendSchema = z.object({
		mail_domain: z.string().min(1, 'Email domain is required')
	});

	const directSendForm = new Form(directSendSchema, async (values) => {
		const res = await fetch('/setup/api/save-email-settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				mail_transport: 'direct',
				mail_domain: values.mail_domain,
				ses_region: ''
			})
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message ?? 'Failed to save email settings');
		}
		send({ type: 'NEXT' });
	});

	// ── Create Admin Account ────────────────────────────────────────
	const adminSchema = z
		.object({
			name: z.string().min(1, 'Name is required'),
			username: z
				.string()
				.min(3, 'Username must be at least 3 characters')
				.regex(/^[a-z0-9_-]+$/, 'Lowercase letters, numbers, _ and - only'),
			email: z.string().email('Valid email required'),
			password: z.string().min(8, 'Password must be at least 8 characters'),
			confirmPassword: z.string()
		})
		.refine((v) => v.password === v.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword']
		});

	const adminFields = [
		{
			id: 'setup-name',
			key: 'name',
			label: 'Full Name',
			type: 'text',
			placeholder: 'Jane Smith',
			autocomplete: 'name'
		},
		{
			id: 'setup-username',
			key: 'username',
			label: 'Username',
			type: 'text',
			placeholder: 'janesmith',
			autocomplete: 'username'
		},
		{
			id: 'setup-email',
			key: 'email',
			label: 'Email Address',
			type: 'email',
			placeholder: 'jane@example.com',
			autocomplete: 'email'
		},
		{
			id: 'setup-password',
			key: 'password',
			label: 'Password',
			type: 'password',
			placeholder: '••••••••',
			autocomplete: 'new-password'
		},
		{
			id: 'setup-confirm',
			key: 'confirmPassword',
			label: 'Confirm Password',
			type: 'password',
			placeholder: '••••••••',
			autocomplete: 'new-password'
		}
	] as const;

	const adminForm = new Form(adminSchema, async (values) => {
		const res = await fetch('/setup/api/create-admin', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: values.name,
				username: values.username,
				email: values.email,
				password: values.password
			})
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message ?? 'Failed to create admin account');
		}
		send({ type: 'NEXT' });
	});

	// ── Select Customizations ───────────────────────────────────────
	const customizationSchema = z.object({
		application_name: z.string().min(1, 'Application name is required'),
		logo_src: z.string()
	});

	let catGifsEnabled = $state(true);

	const customizationForm = new Form(
		customizationSchema,
		async (values) => {
			const settings: Record<string, string> = {
				application_name: values.application_name,
				'errors.cat_gifs': String(catGifsEnabled)
			};
			if (values.logo_src.trim()) {
				settings.logo_src = values.logo_src.trim();
			}
			await saveConfig(settings);
			send({ type: 'NEXT' });
		},
		{ application_name: 'TurfBuilder', logo_src: '' }
	);

	// ── Select Map Tile Server ──────────────────────────────────────
	const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
	let mapStyleUrl = $state(DEFAULT_MAP_STYLE_URL);

	async function saveMapStyle() {
		const trimmed = mapStyleUrl.trim();
		try {
			new URL(trimmed);
		} catch {
			stepError = 'Map style URL must be a valid URL.';
			return;
		}
		await saveAndSend({ 'map.style_url': trimmed }, { type: 'NEXT' });
	}

	// ── Tenancy ─────────────────────────────────────────────────────
	async function chooseTenantMode(mode: 'single' | 'multi') {
		await saveAndSend(
			{ 'tenant.mode': mode },
			{ type: mode === 'single' ? 'SINGLE_TENANT' : 'MULTI_TENANT' }
		);
	}

	async function chooseComplexity(complexity: 'simple' | 'full') {
		await saveAndSend(
			{ 'org.complexity': complexity },
			{ type: complexity === 'simple' ? 'SIMPLE_MODE' : 'FULL_FEATURED_MODE' }
		);
	}

	let allowPublicOrgCreation = $state(true);

	// ── Overture ────────────────────────────────────────────────────
	let tbiAccessKey = $state('');
	let natsUrl = $state('nats://localhost:4222');

	async function connectTbi(event: SetupEvent) {
		if (!tbiAccessKey.trim()) {
			stepError = 'Enter your TurfBuilder Infrastructure access key.';
			return;
		}
		await saveAndSend(
			{
				'overture.enabled': 'true',
				'overture.host_mode': 'turfbuilder',
				'overture.access_key': tbiAccessKey.trim()
			},
			event
		);
	}

	async function saveNatsUrl() {
		if (!natsUrl.trim()) {
			stepError = 'Enter a NATs server URL.';
			return;
		}
		await saveAndSend(
			{
				'overture.enabled': 'true',
				'overture.host_mode': 'self_hosted',
				'overture.nats_url': natsUrl.trim()
			},
			{ type: 'NEXT' }
		);
	}

	const inputClass =
		'w-full px-3 py-2.5 rounded-lg text-sm bg-surface-container-low text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary';
	const primaryButtonClass =
		'py-2.5 px-6 rounded-lg font-medium text-sm transition-colors bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed';
	const secondaryButtonClass =
		'py-2.5 px-6 rounded-lg font-medium text-sm border border-outline text-on-surface hover:bg-surface-container transition-colors';
	const choiceCardClass =
		'w-full text-left rounded-xl border border-outline p-4 hover:border-primary hover:bg-surface-container transition-colors';
</script>

{#snippet stepErrorBox()}
	{#if stepError}
		<div
			class="mt-4 bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container"
		>
			{stepError}
		</div>
	{/if}
{/snippet}

{#snippet tbiConnectForm(connectEvent: SetupEvent, skippable: boolean)}
	<p class="text-on-surface-subtle text-sm mb-6">
		Connect this instance to TurfBuilder Infrastructure to enable hosted Overture data downloads.
	</p>

	<div>
		<label class="block text-sm font-medium text-on-surface mb-1" for="setup-tbi-key">
			Access Key
		</label>
		<input
			id="setup-tbi-key"
			type="password"
			bind:value={tbiAccessKey}
			placeholder="tbi_xxxxxxxxxxxx"
			autocomplete="off"
			class={inputClass}
		/>
		<p class="text-on-surface-subtle text-xs mt-1">
			The access key is stored in the database and used to authenticate with the TurfBuilder
			Infrastructure API.
		</p>
	</div>

	{@render stepErrorBox()}

	<div class="mt-6 flex gap-3 justify-end">
		{#if skippable}
			<button
				onclick={() => saveAndSend({ 'overture.enabled': 'false' }, { type: 'SKIP' })}
				disabled={stepSaving}
				class={secondaryButtonClass}
			>
				Skip This
			</button>
		{/if}
		<button
			onclick={() => connectTbi(connectEvent)}
			disabled={stepSaving}
			class={primaryButtonClass}
		>
			{stepSaving ? 'Connecting…' : 'Connect'}
		</button>
	</div>
{/snippet}

<div class="min-h-screen bg-surface flex items-center justify-center p-4">
	<div class="w-full max-w-lg">
		<!-- Header -->
		<div class="text-center mb-8">
			<img src="/logos/default-logo.svg" alt="TurfBuilder" class="h-12 mx-auto mb-3" />
			<p class="text-on-surface-subtle mt-1">Get your instance up and running in minutes.</p>
		</div>

		<!-- Phase indicator -->
		<div class="flex items-center justify-center gap-2 mb-8">
			{#each PHASES as phase, i (phase.label)}
				<div class="flex flex-col items-center gap-1">
					<div
						class="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors
							{phaseIndex === i
							? 'bg-primary text-on-primary'
							: phaseIndex > i
								? 'bg-success text-on-success'
								: 'bg-surface-container-high text-on-surface-subtle'}"
						title={phase.label}
					>
						{#if phaseIndex > i}✓{:else}{i + 1}{/if}
					</div>
				</div>
				{#if i < PHASES.length - 1}
					<div class="w-5 h-0.5 mb-0 {phaseIndex > i ? 'bg-success' : 'bg-outline-subtle'}"></div>
				{/if}
			{/each}
		</div>

		<div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-subtle p-8">
			<!-- ================================================================
			     Confirm Database Connection
			     ================================================================ -->
			{#if stateValue === 'Confirm Database Connection'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Database Connection</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Verify that your <code class="bg-surface-container px-1 rounded text-xs">DATABASE_URL</code>
					in <code class="bg-surface-container px-1 rounded text-xs">.env</code> is reachable before continuing.
				</p>

				<button
					onclick={checkDb}
					disabled={dbStatus === 'checking'}
					class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{dbStatus === 'checking' ? 'Testing…' : 'Test Connection'}
				</button>

				{#if dbStatus === 'ok'}
					<div
						class="mt-4 flex items-center gap-2 text-on-success-container bg-success-container border border-success rounded-lg px-4 py-3 text-sm"
					>
						<span class="text-base">✓</span>
						<span>Connected successfully.</span>
					</div>
				{/if}

				<div class="mt-6 flex justify-end">
					<button
						onclick={() => send({ type: 'DB_CONNECTION_SUCCESS' })}
						disabled={dbStatus !== 'ok'}
						class="py-2.5 px-6 rounded-lg font-medium text-sm transition-colors bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Continue →
					</button>
				</div>

				<!-- ================================================================
			     Database Help
			     ================================================================ -->
			{:else if stateValue === 'Database Help'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Database Connection Help</h2>
				<p class="text-on-surface-subtle text-sm mb-4">
					The database could not be reached. The error was:
				</p>

				<div
					class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container mb-4"
				>
					<p class="font-mono text-xs break-all">{dbError || 'Connection failed'}</p>
				</div>

				<ul class="text-sm text-on-surface-subtle list-disc pl-5 space-y-1 mb-6">
					<li>
						Check that <code class="bg-surface-container px-0.5 rounded text-xs">DATABASE_URL</code>
						in your <code class="bg-surface-container px-0.5 rounded text-xs">.env</code> file is correct.
					</li>
					<li>Ensure PostgreSQL is running and accepting connections.</li>
					<li>If using Docker Compose, confirm the database container is up.</li>
					<li>Verify the database user has permission to connect.</li>
				</ul>

				<div class="flex justify-end">
					<button
						onclick={() => {
							dbStatus = 'idle';
							dbError = '';
							send({ type: 'RETRY' });
						}}
						class={primaryButtonClass}
					>
						Try Again
					</button>
				</div>

				<!-- ================================================================
			     Database Schema Setup
			     ================================================================ -->
			{:else if stateValue === 'Database Schema Setup'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Initialize Database</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Create all tables, indexes, and security policies. Safe to run on an existing database —
					nothing will be overwritten.
				</p>

				{#if !schemaStarted}
					<button
						onclick={createSchema}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-primary text-on-primary hover:opacity-90 transition-colors"
					>
						Initialize Database
					</button>
				{:else}
					<div class="w-full bg-surface-container rounded-full h-2 mb-5">
						<div
							class="h-2 rounded-full transition-all duration-300 {schemaComplete
								? 'bg-success'
								: 'bg-primary'}"
							style="width: {schemaComplete ? 100 : progressPercent}%"
						></div>
					</div>

					<div class="space-y-2 max-h-64 overflow-y-auto">
						{#each progressItems as item (item.step)}
							<div class="flex items-center gap-3 text-sm">
								<span class="w-5 text-center shrink-0">
									{#if item.status === 'done'}
										<span class="text-success">✓</span>
									{:else if item.status === 'running'}
										<span class="text-primary animate-spin inline-block">⟳</span>
									{:else if item.status === 'error'}
										<span class="text-error">✗</span>
									{/if}
								</span>
								<span class={item.status === 'error' ? 'text-error' : 'text-on-surface'}>
									{item.label}
								</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="mt-6 flex justify-end">
					<button
						onclick={() => send({ type: 'SCHEMA_SETUP_SUCCESS' })}
						disabled={!schemaComplete}
						class="py-2.5 px-6 rounded-lg font-medium text-sm transition-colors bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Continue →
					</button>
				</div>

				<!-- ================================================================
			     Error Display (schema setup failed)
			     ================================================================ -->
			{:else if stateValue === 'Error Display'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Database Setup Failed</h2>
				<p class="text-on-surface-subtle text-sm mb-4">
					An error occurred while initializing the database schema:
				</p>

				<div
					class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container mb-6"
				>
					<p class="font-mono text-xs break-all">{schemaError || 'Unknown error'}</p>
				</div>

				<div class="flex justify-end">
					<button
						onclick={() => {
							resetSchemaState();
							send({ type: 'RETRY' });
						}}
						class={primaryButtonClass}
					>
						Try Again
					</button>
				</div>

				<!-- ================================================================
			     Configure Base URL's
			     ================================================================ -->
			{:else if stateValue === "Configure Base URL's"}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Base URLs</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Enter the public URLs this instance will be served from. The first host is the primary
					base URL, used for auth callbacks. Additional hosts are trusted origins.
				</p>

				<div class="space-y-3">
					{#each hosts as host, i (i)}
						<div class="flex gap-2">
							<input
								type="url"
								bind:value={hosts[i]}
								placeholder="https://app.example.com"
								autocomplete="url"
								aria-label="Host {i + 1}"
								class={inputClass}
							/>
							{#if hosts.length > 1}
								<button
									onclick={() => (hosts = hosts.filter((_, idx) => idx !== i))}
									aria-label="Remove host {i + 1}"
									class="px-3 rounded-lg border border-outline text-on-surface-subtle hover:bg-surface-container transition-colors"
								>
									✕
								</button>
							{/if}
						</div>
					{/each}
				</div>

				<button
					onclick={() => (hosts = [...hosts, ''])}
					class="mt-3 text-sm text-primary hover:underline"
				>
					+ Add another host
				</button>

				{@render stepErrorBox()}

				<div class="mt-6 flex justify-end">
					<button onclick={saveHosts} disabled={stepSaving} class={primaryButtonClass}>
						{stepSaving ? 'Saving…' : 'Save & Continue →'}
					</button>
				</div>

				<!-- ================================================================
			     Select Email Mode
			     ================================================================ -->
			{:else if stateValue === 'Select Email Mode'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Email Delivery</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Choose how this instance sends outgoing email (invitations, password resets).
				</p>

				<div class="space-y-3">
					<button onclick={() => send({ type: 'AWS_SES' })} class={choiceCardClass}>
						<p class="font-medium text-on-surface text-sm">Amazon SES</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Deliver email through AWS Simple Email Service. Recommended for production.
						</p>
					</button>

					<button onclick={() => (directSendWarningVisible = true)} class={choiceCardClass}>
						<p class="font-medium text-on-surface text-sm">Direct Send from Machine</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Deliver email directly from the application server.
						</p>
					</button>
				</div>

				{#if directSendWarningVisible}
					<div
						class="mt-4 bg-warning-container border border-warning rounded-lg px-4 py-3 text-sm text-on-warning-container"
					>
						<p class="font-medium mb-1">Warning</p>
						<p class="text-xs">
							Many email providers block mail sent directly from application servers. Direct Send
							should not be used without cause — delivery rates may be poor.
						</p>
						<button
							onclick={() => send({ type: 'DIRECT_SEND' })}
							class="mt-3 py-2 px-4 rounded-lg font-medium text-xs border border-outline text-on-surface hover:bg-surface-container transition-colors"
						>
							Use Direct Send Anyway
						</button>
					</div>
				{/if}

				<!-- ================================================================
			     Configure AWS SES
			     ================================================================ -->
			{:else if stateValue === 'Configure AWS SES'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Configure Amazon SES</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Configure your SES sending identity. You can change these settings later from the
					infrastructure dashboard.
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						sesForm.submit();
					}}
					class="space-y-4"
				>
					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-ses-domain">
							Email Domain
						</label>
						<input
							id="setup-ses-domain"
							type="text"
							bind:value={sesForm.values.mail_domain}
							placeholder="mail.example.com"
							autocomplete="off"
							class={inputClass}
						/>
						{#if sesForm.errors.mail_domain}
							<p class="text-error text-xs mt-1">{sesForm.errors.mail_domain}</p>
						{:else}
							<p class="text-on-surface-subtle text-xs mt-1">
								The domain from which emails will be sent. Ensure SPF and DKIM records are
								configured.
							</p>
						{/if}
					</div>

					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-ses-region">
							AWS Region
						</label>
						<input
							id="setup-ses-region"
							type="text"
							bind:value={sesForm.values.ses_region}
							placeholder="us-east-1"
							autocomplete="off"
							class={inputClass}
						/>
						{#if sesForm.errors.ses_region}
							<p class="text-error text-xs mt-1">{sesForm.errors.ses_region}</p>
						{:else}
							<p class="text-on-surface-subtle text-xs mt-1">
								The AWS region where your SES sending identity is configured.
							</p>
						{/if}
					</div>

					{#if sesForm.errorMessage}
						<div
							class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container"
						>
							{sesForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={sesForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2 bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{sesForm.submitting ? 'Saving…' : 'Save & Continue →'}
					</button>
				</form>

				<!-- ================================================================
			     Configure Direct Send
			     ================================================================ -->
			{:else if stateValue === 'Configure Direct Send'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Configure Direct Send</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Email will be delivered directly from this server. You can change these settings later
					from the infrastructure dashboard.
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						directSendForm.submit();
					}}
					class="space-y-4"
				>
					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-direct-domain">
							Email Domain
						</label>
						<input
							id="setup-direct-domain"
							type="text"
							bind:value={directSendForm.values.mail_domain}
							placeholder="mail.example.com"
							autocomplete="off"
							class={inputClass}
						/>
						{#if directSendForm.errors.mail_domain}
							<p class="text-error text-xs mt-1">{directSendForm.errors.mail_domain}</p>
						{:else}
							<p class="text-on-surface-subtle text-xs mt-1">
								The domain from which emails will be sent. Ensure SPF and DKIM records are
								configured.
							</p>
						{/if}
					</div>

					{#if directSendForm.errorMessage}
						<div
							class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container"
						>
							{directSendForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={directSendForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2 bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{directSendForm.submitting ? 'Saving…' : 'Save & Continue →'}
					</button>
				</form>

				<!-- ================================================================
			     Create Admin Account
			     ================================================================ -->
			{:else if stateValue === 'Create Admin Account'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Create Admin Account</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					This account will have full infrastructure access and can create and manage
					organizations.
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						adminForm.submit();
					}}
					class="space-y-4"
				>
					{#each adminFields as field (field.id)}
						<div>
							<label class="block text-sm font-medium text-on-surface mb-1" for={field.id}>
								{field.label}
							</label>
							<input
								id={field.id}
								type={field.type}
								bind:value={adminForm.values[field.key]}
								placeholder={field.placeholder}
								autocomplete={field.autocomplete}
								class="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-container-low text-on-surface border focus:outline-none focus:ring-2 focus:ring-primary {adminForm
									.errors[field.key]
									? 'border-error'
									: 'border-outline'}"
							/>
							{#if adminForm.errors[field.key]}
								<p class="text-error text-xs mt-1">{adminForm.errors[field.key]}</p>
							{/if}
						</div>
					{/each}

					{#if adminForm.errorMessage}
						<div
							class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container"
						>
							{adminForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={adminForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2 bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{adminForm.submitting ? 'Creating account…' : 'Create Admin Account'}
					</button>
				</form>

				<!-- ================================================================
			     Select Customizations
			     ================================================================ -->
			{:else if stateValue === 'Select Customizations'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Customize Your Instance</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					These values are stored in the database and can be changed later.
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						customizationForm.submit();
					}}
					class="space-y-4"
				>
					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-app-name">
							Application Name
						</label>
						<input
							id="setup-app-name"
							type="text"
							bind:value={customizationForm.values.application_name}
							placeholder="TurfBuilder"
							autocomplete="off"
							class={inputClass}
						/>
						{#if customizationForm.errors.application_name}
							<p class="text-error text-xs mt-1">{customizationForm.errors.application_name}</p>
						{/if}
					</div>

					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-logo-src">
							Logo Path (optional)
						</label>
						<input
							id="setup-logo-src"
							type="text"
							bind:value={customizationForm.values.logo_src}
							placeholder="/logos/default-logo.svg"
							autocomplete="off"
							class={inputClass}
						/>
						<p class="text-on-surface-subtle text-xs mt-1">
							Path to the logo image shown in the UI. Leave blank to use the default.
						</p>
					</div>

					<label class="flex items-center gap-2 text-sm text-on-surface">
						<input type="checkbox" bind:checked={catGifsEnabled} class="rounded" />
						Show cat GIFs on error pages
					</label>

					{#if customizationForm.errorMessage}
						<div
							class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container"
						>
							{customizationForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={customizationForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2 bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{customizationForm.submitting ? 'Saving…' : 'Save & Continue →'}
					</button>
				</form>

				<!-- ================================================================
			     Select Map Tile Server
			     ================================================================ -->
			{:else if stateValue === 'Select Map Tile Server'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Map Tile Server</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					The MapLibre style URL used to render maps. Defaults to OpenFreeMap.
				</p>

				<div>
					<label class="block text-sm font-medium text-on-surface mb-1" for="setup-map-style">
						Map Style URL
					</label>
					<input
						id="setup-map-style"
						type="url"
						bind:value={mapStyleUrl}
						placeholder={DEFAULT_MAP_STYLE_URL}
						autocomplete="off"
						class={inputClass}
					/>
				</div>

				{@render stepErrorBox()}

				<div class="mt-6 flex justify-end">
					<button onclick={saveMapStyle} disabled={stepSaving} class={primaryButtonClass}>
						{stepSaving ? 'Saving…' : 'Save & Continue →'}
					</button>
				</div>

				<!-- ================================================================
			     Select Tenant Mode
			     ================================================================ -->
			{:else if stateValue === 'Select Tenant Mode'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Tenancy Mode</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Choose whether this instance hosts a single organization or many.
				</p>

				<div class="space-y-3">
					<button
						onclick={() => chooseTenantMode('single')}
						disabled={stepSaving}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">Single Tenant</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							One organization, named after the application. Best for a single campaign or team.
						</p>
					</button>

					<button
						onclick={() => chooseTenantMode('multi')}
						disabled={stepSaving}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">Multi-Tenant</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Host many organizations on one instance.
						</p>
					</button>
				</div>

				{@render stepErrorBox()}

				<!-- ================================================================
			     Single: Select Application Complexity
			     ================================================================ -->
			{:else if stateValue === 'Single: Select Application Complexity'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Application Complexity</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					An organization with the same name as the application will be created.
				</p>

				<div class="space-y-3">
					<button
						onclick={() => chooseComplexity('simple')}
						disabled={stepSaving}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">Simple Mode</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							A streamlined interface with the essentials for canvassing.
						</p>
					</button>

					<button
						onclick={() => chooseComplexity('full')}
						disabled={stepSaving}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">Full Featured Mode</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							All features enabled, including Overture location data imports.
						</p>
					</button>
				</div>

				{@render stepErrorBox()}

				<!-- ================================================================
			     Allow Anyone to Create an Org
			     ================================================================ -->
			{:else if stateValue === 'Allow Anyone to Create an Org'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Organization Creation</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Control who can create new organizations on this instance.
				</p>

				<label class="flex items-center gap-2 text-sm text-on-surface">
					<input type="checkbox" bind:checked={allowPublicOrgCreation} class="rounded" />
					Allow anyone to create an organization
				</label>
				<p class="text-on-surface-subtle text-xs mt-1 pl-6">
					When disabled, only infrastructure administrators can create organizations.
				</p>

				{@render stepErrorBox()}

				<div class="mt-6 flex justify-end">
					<button
						onclick={() =>
							saveAndSend(
								{ 'org.allow_public_creation': String(allowPublicOrgCreation) },
								{ type: 'NEXT' }
							)}
						disabled={stepSaving}
						class={primaryButtonClass}
					>
						{stepSaving ? 'Saving…' : 'Save & Continue →'}
					</button>
				</div>

				<!-- ================================================================
			     Select Overture Host
			     ================================================================ -->
			{:else if stateValue === 'Select Overture Host'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Overture Data Host</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Overture provides open location data for imports. Choose where downloads are processed.
				</p>

				<div class="space-y-3">
					<button
						onclick={() => send({ type: 'TURFBUILDER_INFRASTRUCTURE' })}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">TurfBuilder Infrastructure LLC</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Hosted download service. Requires a TurfBuilder Infrastructure account.
						</p>
					</button>

					<button onclick={() => send({ type: 'SELF_HOSTED' })} class={choiceCardClass}>
						<p class="font-medium text-on-surface text-sm">Self-Hosted</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Run your own Overture download worker and connect via NATs.
						</p>
					</button>

					<button
						onclick={() => saveAndSend({ 'overture.enabled': 'false' }, { type: 'DISABLE_OVERTURE' })}
						disabled={stepSaving}
						class={choiceCardClass}
					>
						<p class="font-medium text-on-surface text-sm">Disable Overture</p>
						<p class="text-on-surface-subtle text-xs mt-1">
							Skip Overture imports. Can be enabled later from the infrastructure dashboard.
						</p>
					</button>
				</div>

				{@render stepErrorBox()}

				<!-- ================================================================
			     ST: Connect TurfBuilder Infrastructure Account
			     ================================================================ -->
			{:else if stateValue === 'ST: Connect TurfBuilder Infrastructure Account'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">
					Connect TurfBuilder Infrastructure
				</h2>
				{@render tbiConnectForm({ type: 'LOGIN' }, true)}

				<!-- ================================================================
			     MT: Connect TurfBuilder Infrastructure Account
			     ================================================================ -->
			{:else if stateValue === 'MT: Connect TurfBuilder Infrastructure Account'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">
					Connect TurfBuilder Infrastructure
				</h2>
				{@render tbiConnectForm({ type: 'NEXT' }, false)}

				<!-- ================================================================
			     Configure NATs URL for Overture
			     ================================================================ -->
			{:else if stateValue === 'Configure NATs URL for Overture'}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Overture NATs Server</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Enter the URL of the NATs server your self-hosted Overture download worker is connected
					to.
				</p>

				<div>
					<label class="block text-sm font-medium text-on-surface mb-1" for="setup-nats-url">
						NATs URL
					</label>
					<input
						id="setup-nats-url"
						type="text"
						bind:value={natsUrl}
						placeholder="nats://localhost:4222"
						autocomplete="off"
						class={inputClass}
					/>
				</div>

				{@render stepErrorBox()}

				<div class="mt-6 flex justify-end">
					<button onclick={saveNatsUrl} disabled={stepSaving} class={primaryButtonClass}>
						{stepSaving ? 'Saving…' : 'Save & Continue →'}
					</button>
				</div>

				<!-- ================================================================
			     Finished
			     ================================================================ -->
			{:else if stateValue === 'Finished'}
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-success-container text-on-success-container text-2xl"
					>
						✓
					</div>
					<h2 class="text-xl font-semibold text-on-surface mb-1">Setup Complete</h2>
					<p class="text-on-surface-subtle text-sm mb-6">
						Your instance is configured. Sign in with your admin account to get started.
					</p>
					<a href="/auth/signin" class="inline-block {primaryButtonClass}"> Go to Sign In </a>
				</div>
			{/if}
		</div>
	</div>
</div>
