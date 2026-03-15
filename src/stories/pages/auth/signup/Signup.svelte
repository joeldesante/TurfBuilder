<script lang="ts">
	import FormStep from '../steps/FormStep.svelte';
	import { goto } from '$app/navigation';

	interface Props {
		data: unknown;
		redirectTo?: string;
	}

	let { data, redirectTo = '/' }: Props = $props();

	const signinHref = $derived(
		redirectTo !== '/'
			? `/auth/signin?redirectTo=${encodeURIComponent(redirectTo)}`
			: '/auth/signin'
	);

	let errorMessage = $state('');
</script>

<div>
	<FormStep
		onComplete={async (username: string, password: string) => {
			username = username;
			password = password;
			goto(redirectTo);
		}}
	/>
	<div class="text-center mt-4">
		<p class="text-sm">Already have an account? <a href={signinHref}>Sign in</a></p>
	</div>
</div>
