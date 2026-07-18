<script lang="ts">
	import { interpret } from 'robot3';
	import { machine } from './SetupWizard.robot';
	import Logo from '$components/layout/fragments/logo/Logo.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import TelemetryStep from './steps/TelemetryStep.svelte';
	import URLsStep from './steps/URLsStep.svelte';
	import TenateModeStep from './steps/TenateModeStep.svelte';
	import OrgSettingsStep from './steps/OrgSettingsStep.svelte';
	import ServicesStep from './steps/ServicesStep.svelte';
	import ThemeStep from './steps/ThemeStep.svelte';

	const service = interpret(machine, () => {
		current = service.machine.current;
		context = service.context;
	});

	let current = $state(service.machine.current);
	let context = $state(service.context);
</script>

<div class="flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:p-6">
	<div class="flex w-full max-w-md flex-col gap-10">
		<header class="flex justify-center">
			<Logo height={32} />
		</header>
		{#if current === 'checkDatabaseConnection'}
			<p>Checking database connection…</p>
			<Button onclick={() => service.send('success')}>Stub: success</Button>
			<Button onclick={() => service.send('failed')}>Stub: failed</Button>
		{:else if current === 'initializeDatabase'}
			<p>Initializing database…</p>
			<Button onclick={() => service.send('success')}>Stub: success</Button>
			<Button onclick={() => service.send('failed')}>Stub: failed</Button>
		{:else if current === 'databaseError'}
			<p>Something went wrong while setting up the database.</p>
		{:else if current === 'confirmTelemetry'}
			<TelemetryStep onNext={async (values) => service.send({ type: 'next', ...values })} />
		{:else if current === 'setURLs'}
			<URLsStep onNext={async (values) => service.send({ type: 'next', ...values })} />
		{:else if current === 'tenateMode'}
			<TenateModeStep
				onSingle={() => service.send('single')}
				onMulti={() => service.send('multi')}
			/>
		{:else if current === 'orgSettings'}
			<OrgSettingsStep onNext={async (values) => service.send({ type: 'next', ...values })} />
		{:else if current === 'services'}
			<ServicesStep onNext={async (values) => service.send({ type: 'next', ...values })} />
		{:else if current === 'theme'}
			<ThemeStep onNext={async (values) => service.send({ type: 'next', ...values })} />
		{:else if current === 'done'}
			<p>Setup complete.</p>
			<pre class="overflow-x-auto text-sm">{JSON.stringify(context, null, 2)}</pre>
		{/if}
	</div>
</div>
