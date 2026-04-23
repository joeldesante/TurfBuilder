<script lang="ts">
	import { Form } from '$lib/client/formstorm/form.svelte.ts';
	import { z } from 'zod';

	type StepStatus = 'pending' | 'running' | 'done' | 'error';

	interface SchemaProgress {
		step: number;
		total: number;
		label: string;
		status: StepStatus;
		error?: string;
	}

	let currentStep = $state<1 | 2 | 3 | 4>(1);

	// Step 1 — DB check
	let dbStatus = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');
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
				dbStatus = 'error';
				dbError = data.error ?? 'Connection failed';
			}
		} catch (e) {
			dbStatus = 'error';
			dbError = String(e);
		}
	}

	// Step 2 — Schema creation
	let schemaStarted = $state(false);
	let schemaComplete = $state(false);
	let schemaError = $state('');
	let progressItems = $state<SchemaProgress[]>([]);

	async function createSchema() {
		schemaStarted = true;
		schemaError = '';
		progressItems = [];

		const res = await fetch('/setup/api/create-schema', { method: 'POST' });
		if (!res.body) {
			schemaError = 'No response body';
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
					return;
				}
			}
		}
	}

	// Step 3 — App settings
	const settingsSchema = z.object({
		base_url: z.string().url('Must be a valid URL (include https://)'),
		application_name: z.string().min(1, 'Application name is required')
	});

	const settingsForm = new Form(
		settingsSchema,
		async (values) => {
			const res = await fetch('/setup/api/save-settings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(values)
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message ?? 'Failed to save settings');
			}
			currentStep = 4;
		},
		{
			base_url: typeof window !== 'undefined' ? window.location.origin : '',
			application_name: 'TurfBuilder'
		}
	);

	// Step 4 — Admin user
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
		window.location.href = '/auth/signin';
	});

	let progressPercent = $derived(
		progressItems.length === 0
			? 0
			: Math.round(
					(progressItems.filter((p) => p.status === 'done').length /
						(progressItems[0]?.total ?? 1)) *
						100
				)
	);

	const TOTAL_STEPS = 4;
</script>

<div class="min-h-screen bg-surface flex items-center justify-center p-4">
	<div class="w-full max-w-lg">
		<!-- Header -->
		<div class="text-center mb-8">
			<img src="/logos/default-logo.svg" alt="TurfBuilder" class="h-12 mx-auto mb-3" />
			<p class="text-on-surface-subtle mt-1">Get your instance up and running in minutes.</p>
		</div>

		<!-- Step indicator -->
		<div class="flex items-center justify-center gap-3 mb-8">
			{#each [1, 2, 3, 4] as n}
				<div
					class="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors
						{currentStep === n
						? 'bg-primary text-on-primary'
						: currentStep > n
							? 'bg-success text-on-success'
							: 'bg-surface-container-high text-on-surface-subtle'}"
				>
					{#if currentStep > n}✓{:else}{n}{/if}
				</div>
				{#if n < TOTAL_STEPS}
					<div class="w-10 h-0.5 {currentStep > n ? 'bg-success' : 'bg-outline-subtle'}"></div>
				{/if}
			{/each}
		</div>

		<div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-subtle p-8">

			<!-- ================================================================
			     STEP 1 — Database connection check
			     ================================================================ -->
			{#if currentStep === 1}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Database Connection</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Verify that your <code class="bg-surface-container px-1 rounded text-xs">DATABASE_URL</code> in
					<code class="bg-surface-container px-1 rounded text-xs">.env</code> is reachable before continuing.
				</p>

				<button
					onclick={checkDb}
					disabled={dbStatus === 'checking'}
					class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors
						bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{dbStatus === 'checking' ? 'Testing…' : 'Test Connection'}
				</button>

				{#if dbStatus === 'ok'}
					<div class="mt-4 flex items-center gap-2 text-on-success-container bg-success-container border border-success rounded-lg px-4 py-3 text-sm">
						<span class="text-base">✓</span>
						<span>Connected successfully.</span>
					</div>
				{/if}

				{#if dbStatus === 'error'}
					<div class="mt-4 bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container">
						<p class="font-medium mb-1">Connection failed</p>
						<p class="font-mono text-xs break-all">{dbError}</p>
						<p class="mt-2 opacity-80">
							Check your <code class="bg-surface-container px-0.5 rounded">DATABASE_URL</code> and ensure PostgreSQL is running.
						</p>
					</div>
				{/if}

				<div class="mt-6 flex justify-end">
					<button
						onclick={() => (currentStep = 2)}
						disabled={dbStatus !== 'ok'}
						class="py-2.5 px-6 rounded-lg font-medium text-sm transition-colors
							bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Continue →
					</button>
				</div>

			<!-- ================================================================
			     STEP 2 — Schema creation
			     ================================================================ -->
			{:else if currentStep === 2}
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
				{/if}

				{#if schemaStarted}
					<!-- Progress bar -->
					<div class="w-full bg-surface-container rounded-full h-2 mb-5">
						<div
							class="h-2 rounded-full transition-all duration-300
								{schemaError ? 'bg-error' : schemaComplete ? 'bg-success' : 'bg-primary'}"
							style="width: {schemaComplete ? 100 : progressPercent}%"
						></div>
					</div>

					<!-- Step list -->
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
								<span class="{item.status === 'error' ? 'text-error' : 'text-on-surface'}">{item.label}</span>
							</div>
						{/each}
					</div>

					{#if schemaError}
						<div class="mt-4 bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container">
							<p class="font-medium">Setup failed</p>
							<p class="font-mono text-xs mt-1 break-all">{schemaError}</p>
						</div>
						<button
							onclick={() => { schemaStarted = false; schemaComplete = false; schemaError = ''; progressItems = []; }}
							class="mt-4 w-full py-2.5 px-4 rounded-lg font-medium text-sm border border-outline text-on-surface hover:bg-surface-container transition-colors"
						>
							Try Again
						</button>
					{/if}
				{/if}

				<div class="mt-6 flex justify-end">
					<button
						onclick={() => (currentStep = 3)}
						disabled={!schemaComplete}
						class="py-2.5 px-6 rounded-lg font-medium text-sm transition-colors
							bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Continue →
					</button>
				</div>

			<!-- ================================================================
			     STEP 3 — App settings
			     ================================================================ -->
			{:else if currentStep === 3}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Application Settings</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					Configure your instance. These values are stored in the database and can be changed later.
				</p>

				<form
					onsubmit={(e) => { e.preventDefault(); settingsForm.submit(); }}
					class="space-y-4"
				>
					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-base-url">
							Base URL
						</label>
						<input
							id="setup-base-url"
							type="url"
							bind:value={settingsForm.values.base_url}
							placeholder="https://app.example.com"
							autocomplete="url"
							class="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-container-low text-on-surface
								border focus:outline-none focus:ring-2 focus:ring-primary
								{settingsForm.errors.base_url ? 'border-error' : 'border-outline'}"
						/>
						{#if settingsForm.errors.base_url}
							<p class="text-error text-xs mt-1">{settingsForm.errors.base_url}</p>
						{:else}
							<p class="text-on-surface-subtle text-xs mt-1">The public URL of this instance. Used for auth callbacks and trusted origins.</p>
						{/if}
					</div>

					<div>
						<label class="block text-sm font-medium text-on-surface mb-1" for="setup-app-name">
							Application Name
						</label>
						<input
							id="setup-app-name"
							type="text"
							bind:value={settingsForm.values.application_name}
							placeholder="TurfBuilder"
							autocomplete="off"
							class="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-container-low text-on-surface
								border focus:outline-none focus:ring-2 focus:ring-primary
								{settingsForm.errors.application_name ? 'border-error' : 'border-outline'}"
						/>
						{#if settingsForm.errors.application_name}
							<p class="text-error text-xs mt-1">{settingsForm.errors.application_name}</p>
						{/if}
					</div>

					{#if settingsForm.errorMessage}
						<div class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container">
							{settingsForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={settingsForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2
							bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{settingsForm.submitting ? 'Saving…' : 'Save & Continue →'}
					</button>
				</form>

			<!-- ================================================================
			     STEP 4 — Admin account
			     ================================================================ -->
			{:else if currentStep === 4}
				<h2 class="text-xl font-semibold text-on-surface mb-1">Create Admin Account</h2>
				<p class="text-on-surface-subtle text-sm mb-6">
					This account will have full infrastructure access and can create and manage organizations.
				</p>

				<form
					onsubmit={(e) => { e.preventDefault(); adminForm.submit(); }}
					class="space-y-4"
				>
					{#each [
						{ id: 'setup-name', key: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Smith', autocomplete: 'name' },
						{ id: 'setup-username', key: 'username', label: 'Username', type: 'text', placeholder: 'janesmith', autocomplete: 'username' },
						{ id: 'setup-email', key: 'email', label: 'Email Address', type: 'email', placeholder: 'jane@example.com', autocomplete: 'email' },
						{ id: 'setup-password', key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', autocomplete: 'new-password' },
						{ id: 'setup-confirm', key: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: '••••••••', autocomplete: 'new-password' },
					] as field}
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
								class="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-container-low text-on-surface
									border focus:outline-none focus:ring-2 focus:ring-primary
									{adminForm.errors[field.key] ? 'border-error' : 'border-outline'}"
							/>
							{#if adminForm.errors[field.key]}
								<p class="text-error text-xs mt-1">{adminForm.errors[field.key]}</p>
							{/if}
						</div>
					{/each}

					{#if adminForm.errorMessage}
						<div class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container">
							{adminForm.errorMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={adminForm.submitting}
						class="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors mt-2
							bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{adminForm.submitting ? 'Creating account…' : 'Create Admin Account'}
					</button>
				</form>
			{/if}

		</div>
	</div>
</div>
