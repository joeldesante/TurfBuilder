<script lang="ts">
	import { getContext } from 'svelte';
	import InputGroup from '$components/data-inputs/input-group/InputGroup.svelte';
	import { EyeIcon, EyeSlashIcon } from 'phosphor-svelte';

	type InputType = 'text' | 'email' | 'password' | 'url' | 'tel' | 'search' | 'number';

	interface Props {
		value?: string;
		type?: InputType;
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		readonly?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		value = $bindable(''),
		type = 'text',
		placeholder,
		id,
		disabled = false,
		readonly = false,
		class: className = '',
		...restProps
	}: Props = $props();

	const grouped = !!getContext<boolean | undefined>('inputGroup');

	const ctx = getContext<
		| {
				id: string;
				invalid: boolean;
				disabled: boolean;
				describedBy: string | undefined;
		  }
		| undefined
	>('formField');

	let inputId = $derived(id ?? ctx?.id);
	let isInvalid = $derived(ctx?.invalid ?? false);
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false));
	let describedBy = $derived(ctx?.describedBy);

	let visible = $state(false);
	let effectiveType = $derived(type === 'password' ? (visible ? 'text' : 'password') : type);

	let computedClass = $derived(
		[
			'w-full text-base text-on-surface bg-surface placeholder:text-on-surface-subtle',
			'h-12 md:h-10 px-3 rounded-sm',
			grouped || type === 'password' ? 'focus:outline-none' : 'focus-visible:outline-2 focus-visible:outline-offset-2',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			!(grouped || type === 'password') && 'border',
			!(grouped || type === 'password') && isInvalid
				? 'border-error focus-visible:outline-error'
				: !(grouped || type === 'password')
					? 'border-outline'
					: '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if type === 'password' && !grouped}
	<InputGroup>
		{#snippet trailing()}
			<button
				type="button"
				onclick={() => (visible = !visible)}
				aria-label={visible ? 'Hide password' : 'Show password'}
			>
				{#if visible}
					<EyeSlashIcon size={18} />
				{:else}
					<EyeIcon size={18} />
				{/if}
			</button>
		{/snippet}
		<input
			type={effectiveType}
			id={inputId}
			bind:value
			{placeholder}
			disabled={isDisabled}
			{readonly}
			aria-invalid={isInvalid || undefined}
			aria-describedby={describedBy}
			class={computedClass}
			{...restProps}
		/>
	</InputGroup>
{:else}
	<input
		type={effectiveType}
		id={inputId}
		bind:value
		{placeholder}
		disabled={isDisabled}
		{readonly}
		aria-invalid={isInvalid || undefined}
		aria-describedby={describedBy}
		class={computedClass}
		{...restProps}
	/>
{/if}
