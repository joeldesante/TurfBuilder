<script lang="ts">
	import FormField from '../data-inputs/form-field/FormField.svelte';
	import Checkbox from '../data-inputs/checkbox/Checkbox.svelte';

	interface Props {
		label?: string;
		errors?: string[];
		dirty?: boolean;
		disabled?: boolean;
		helperText?: string;
		id?: string;
	}

	let {
		label = 'Terms',
		errors = [],
		dirty = false,
		disabled = false,
		helperText,
		id
	}: Props = $props();
</script>

<FormField {label} {errors} {dirty} {disabled} {helperText} {id}>
	<Checkbox>I agree to the terms</Checkbox>
</FormField>
