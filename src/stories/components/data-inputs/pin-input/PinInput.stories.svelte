<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PinInput from './PinInput.svelte';
	import FormField from '../form-field/FormField.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/PinInput',
		component: PinInput,
		tags: ['autodocs'],
		argTypes: {
			value: {
				control: 'text',
				description: 'The current value of the pin input. This is a bindable prop.'
			},
			maxlength: {
				control: { type: 'number', min: 1, max: 12 },
				description:
					'The number of cells to render, corresponding to the maximum number of characters the input accepts.'
			},
			pattern: {
				control: false,
				description:
					'A regex string that validates each character as it is typed. Defaults to digits only (`REGEXP_ONLY_DIGITS`). Import `REGEXP_ONLY_CHARS` or `REGEXP_ONLY_DIGITS_AND_CHARS` from `bits-ui` for alternative patterns.'
			},
			onComplete: {
				control: false,
				description:
					'A callback fired when all cells are filled. Useful for auto-submitting a form on completion.'
			},
			onValueChange: {
				control: false,
				description: 'A callback fired whenever the value changes.'
			},
			pasteTransformer: {
				control: false,
				description:
					'A function to sanitize pasted text before it is inserted. For example, to strip hyphens from a pasted code: `(text) => text.replace(/-/g, "")`.'
			},
			name: {
				control: 'text',
				description: 'The name attribute for the hidden input element, used for form submission.'
			},
			autofocus: {
				control: 'boolean',
				description:
					'Whether the input should automatically receive focus when the component mounts.'
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the input is disabled. This can also be inherited from a parent `FormField` component.'
			},
			id: {
				table: { category: 'Derived Props' },
				control: false,
				description:
					'The id attribute for the hidden input element. Auto-inherited from `FormField` context if not provided.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A pin/OTP input for entering verification codes, 2FA tokens, or multi-factor authentication codes. Nest within FormField for labels, helper text, and validation.'
			}
		}
	});
</script>

<Story name="Default" />

<Story name="Four-Digit Code" args={{ maxlength: 4 }} />

<Story name="Within FormField Wrapper" asChild>
	<FormField label="Verification code" helperText="Enter the 6-digit code sent to your email.">
		<PinInput />
	</FormField>
</Story>

<Story name="Required with FormField" asChild>
	<FormField label="Verification code" requirementIndicator="required">
		<PinInput />
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField label="Verification code" errors={['The code you entered is incorrect.']} dirty={true}>
		<PinInput value="123456" />
	</FormField>
</Story>

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Disabled with FormField" asChild>
	<FormField label="Verification code" disabled={true}>
		<PinInput />
	</FormField>
</Story>

<Story name="Pre-filled" args={{ value: '123456' }} />
