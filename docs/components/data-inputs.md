# Data-inputs Components

## Checkbox

**Import:** `$components/data-inputs/checkbox/Checkbox.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean | undefined` | `$bindable(false)` |  |
| `indeterminate` | `boolean | undefined` | `$bindable(false)` |  |
| `onCheckedChange` | `((checked: boolean) => void) | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `invalid` | `boolean | undefined` | — |  |
| `name` | `string | undefined` | — |  |
| `value` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `children` | `Snippet<[]> | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## CheckboxGroup

**Import:** `$components/data-inputs/checkbox-group/CheckboxGroup.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | **required** |  |
| `value` | `string[] | undefined` | `$bindable([])` |  |
| `items` | `CheckboxItem[]` | **required** |  |
| `orientation` | `"vertical" | "horizontal" | undefined` | `'vertical'` |  |
| `requirementIndicator` | `"required" | "optional" | "none" | undefined` | `'none'` |  |
| `helperText` | `string | undefined` | — |  |
| `errors` | `string[] | undefined` | `[]` |  |
| `dirty` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## DatePicker

**Import:** `$components/data-inputs/date-picker/DatePicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `DateValue | undefined` | `$bindable()` |  |
| `placeholder` | `DateValue | undefined` | — |  |
| `minValue` | `DateValue | undefined` | — |  |
| `maxValue` | `DateValue | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `readonly` | `boolean | undefined` | `false` |  |
| `required` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `granularity` | `"day" | "hour" | "minute" | "second" | undefined` | `'day'` |  |
| `locale` | `string | undefined` | `'en'` |  |
| `closeOnDateSelect` | `boolean | undefined` | `true` |  |
| `weekdayFormat` | `"narrow" | "short" | "long" | undefined` | `'short'` |  |
| `fixedWeeks` | `boolean | undefined` | `false` |  |
| `onValueChange` | `((value: DateValue | undefined) => void) | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## FormField

**Import:** `$components/data-inputs/form-field/FormField.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | **required** |  |
| `labelVisibility` | `"visible" | "sr-only" | undefined` | `'visible'` |  |
| `id` | `string | undefined` | — |  |
| `requirementIndicator` | `"required" | "optional" | "none" | undefined` | `'none'` |  |
| `helperText` | `string | undefined` | — |  |
| `errors` | `string[] | undefined` | `[]` |  |
| `dirty` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `children` | `Snippet<[]>` | **required** |  |
| `class` | `string | undefined` | `''` |  |

---

## InputGroup

**Import:** `$components/data-inputs/input-group/InputGroup.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `leading` | `Snippet<[]> | undefined` | — |  |
| `trailing` | `Snippet<[]> | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `children` | `Snippet<[]>` | **required** |  |
| `class` | `string | undefined` | `''` |  |

---

## PinInput

**Import:** `$components/data-inputs/pin-input/PinInput.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `$bindable('')` |  |
| `onValueChange` | `((value: string) => void) | undefined` | — |  |
| `onComplete` | `((value: string) => void) | undefined` | — |  |
| `maxlength` | `number | undefined` | `6` |  |
| `inputmode` | `"text" | "numeric" | "none" | "search" | "email" | "tel" | "url" | "decimal" ...` | `'text'` |  |
| `pattern` | `string | undefined` | `REGEXP_ONLY_DIGITS_AND_CHARS` |  |
| `pasteTransformer` | `((text: string) => string) | undefined` | — |  |
| `autofocus` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## RadioGroup

**Import:** `$components/data-inputs/radio-group/RadioGroup.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | **required** |  |
| `value` | `string | undefined` | `$bindable('')` |  |
| `onValueChange` | `((value: string) => void) | undefined` | — |  |
| `items` | `RadioItem[]` | **required** |  |
| `orientation` | `"vertical" | "horizontal" | undefined` | `'vertical'` |  |
| `requirement` | `"required" | "optional" | "none" | undefined` | `'none'` |  |
| `helperText` | `string | undefined` | — |  |
| `errors` | `string[] | undefined` | `[]` |  |
| `dirty` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `required` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `loop` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## Select

**Import:** `$components/data-inputs/select/Select.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `$bindable('')` |  |
| `items` | `SelectItem[] | undefined` | — |  |
| `groups` | `SelectGroup[] | undefined` | — |  |
| `placeholder` | `string | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## SurveyAnswerOption

**Import:** `$components/data-inputs/survey-answer-option/SurveyAnswerOption.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `OptionType` | **required** |  |
| `label` | `string` | **required** |  |
| `selected` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `value` | `string | undefined` | — |  |
| `onchange` | `((e: Event) => void) | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## SurveyQuestion

**Import:** `$components/data-inputs/survey-question/SurveyQuestion.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `questionNumber` | `number` | **required** |  |
| `questionText` | `string` | **required** |  |
| `questionType` | `QuestionType` | **required** |  |
| `choices` | `string[] | undefined` | `[]` |  |
| `value` | `string | undefined` | `$bindable('')` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## Switch

**Import:** `$components/data-inputs/switch/Switch.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean | undefined` | `$bindable(false)` |  |
| `onCheckedChange` | `((checked: boolean) => void) | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `name` | `string | undefined` | — |  |
| `value` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `children` | `Snippet<[]> | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## TextInput

**Import:** `$components/data-inputs/text-input/TextInput.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `$bindable('')` |  |
| `type` | `InputType | undefined` | `'text'` |  |
| `placeholder` | `string | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `readonly` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## Textarea

**Import:** `$components/data-inputs/textarea/Textarea.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `$bindable('')` |  |
| `placeholder` | `string | undefined` | — |  |
| `rows` | `number | undefined` | — |  |
| `id` | `string | undefined` | — |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `readonly` | `boolean | undefined` | `false` |  |
| `class` | `string | undefined` | `''` |  |

---

## ToggleGroup

**Import:** `$components/data-inputs/toggle-group/ToggleGroup.svelte`

---
