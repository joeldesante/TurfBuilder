<script lang="ts">
	import InputGroup from '../data-inputs/input-group/InputGroup.svelte';
	import TextInput from '../data-inputs/text-input/TextInput.svelte';

	interface Props {
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();
</script>

<InputGroup {disabled}>
	<TextInput placeholder="Enter value" />
</InputGroup>
