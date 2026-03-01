<script lang="ts">
	import FormField from '../data-inputs/form-field/FormField.svelte';
	import TextInput from '../data-inputs/text-input/TextInput.svelte';

	interface Props {
		label?: string;
		requirementIndicator?: 'required' | 'optional' | 'none';
		errors?: string[];
		dirty?: boolean;
		disabled?: boolean;
		helperText?: string;
		id?: string;
	}

	let {
		label = 'Email',
		requirementIndicator = 'none',
		errors = [],
		dirty = false,
		disabled = false,
		helperText,
		id
	}: Props = $props();
</script>

<FormField {label} {requirementIndicator} {errors} {dirty} {disabled} {helperText} {id}>
	<TextInput type="email" placeholder="you@example.com" />
</FormField>
