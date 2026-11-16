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

## CodeEditor

**Import:** `$components/data-inputs/code-editor/CodeEditor.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `$bindable('')` |  |
| `label` | `string` | **required** | Names the editor for screen readers. |
| `language` | `"html" | "plain" | undefined` | `'html'` |  |
| `minHeight` | `number | undefined` | `240` | Minimum height of the editing area in px. |
| `readonly` | `boolean | undefined` | `false` |  |
| `onchange` | `((value: string) => void) | undefined` | — |  |
| `class` | `string | undefined` | `''` |  |

---

## ColorSwatchPicker

A row of color circles to choose one color from a fixed list.

**Import:** `$components/data-inputs/color-swatch-picker/ColorSwatchPicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | **required** | The chosen color, as a hex value from `colors`. |
| `label` | `string | undefined` | `'Color'` | Names the group for screen readers. |
| `colors` | `readonly { name: string; value: string; }[] | undefined` | `LAYER_COLORS` |  |
| `onChange` | `(value: string) => void` | **required** |  |

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

## Dropdown

**Import:** `$components/data-inputs/dropdown/Dropdown.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `Item[]` | **required** |  |
| `value` | `string | undefined` | `$bindable('')` |  |
| `placeholder` | `string | undefined` | `'Select...'` | Shown on the trigger while nothing is selected. |
| `disabled` | `boolean | undefined` | `false` |  |
| `onValueChange` | `((value: string) => void) | undefined` | — |  |
| `searchable` | `boolean | undefined` | — | Whether the open list has a box to filter the options by typing. By default only long
lists (more than 10 options) get one. |
| `heading` | `string | undefined` | — | A heading shown above the options in the open list. |
| `size` | `"md" | "sm" | undefined` | `'md'` | `sm` is a compact pill for tight spots such as toolbars. |
| `class` | `string | undefined` | `''` |  |

---

## FileDropzone

A drop zone with an upload button inside it, for choosing one CSV file. The button is the keyboard and screen reader route to the file browser; mouse users can also click anywhere in the zone. When
`onUpload` is given the file is sent as soon as it is dropped or chosen,
and the whole zone fills left to right as the progress bar.

**Import:** `$components/data-inputs/file-dropzone/FileDropzone.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUpload` | `((file: File, onProgress: (percent: number) => void) => Promise<void>) | unde...` | — | Sends the file. Call `onProgress` with 0 to 100 as it goes. A rejection
is shown under the zone, so its message must be safe to show a user. |
| `disabled` | `boolean | undefined` | `false` | Disables the drop zone and the button. |
| `format` | `"csv" | "geojson" | undefined` | `'csv'` | The one file type the zone takes. |

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
| `helperContent` | `Snippet<[]> | undefined` | — |  |
| `errors` | `string[] | undefined` | `[]` |  |
| `dirty` | `boolean | undefined` | `false` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `children` | `Snippet<[]>` | **required** |  |
| `labelAction` | `Snippet<[]> | undefined` | — |  |
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

## LayerCatalogue

Searches public map layers live: ArcGIS Hub (most cities and agencies), city portals on
Socrata, data.gov and a few Census boundaries. Nothing is listed ahead of time, so it
never goes out of date. Results cover everywhere by default, and can be narrowed to a US city or the map view, and by
source, layer type and publisher. Picking one calls `onPick`.

**Import:** `$components/data-inputs/layer-catalogue/LayerCatalogue.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `getViewBounds` | `(() => Bounds | null) | undefined` | — | The map's current view (west, south, east, north), to search near it. |
| `loadingId` | `string | null | undefined` | `null` | The id of the entry being loaded. Disables the list while set. |
| `onPick` | `(entry: CatalogueEntry) => void` | **required** |  |

---

## LocationForm

**Import:** `$components/data-inputs/location-form/LocationForm.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialValues` | `any` | — | Existing values for an edit flow. Omit to author a new location. |
| `coordinates` | `{ latitude: number; longitude: number; }` | **required** | Pin position. Kept as a prop rather than a form field so a parent map
can move the pin while the form is open and have it follow. |
| `submitLabel` | `string | undefined` | — |  |
| `cancelLabel` | `string | undefined` | — |  |
| `instructions` | `string | undefined` | — | Copy shown above the fields, e.g. field instructions for volunteers. |
| `orgId` | `string | undefined` | — | Enables photo attachment. Omit to hide the uploader entirely. |
| `maxPhotos` | `number | undefined` | — |  |
| `onSubmit` | `(fields: LocationFields) => Promise<void>` | **required** |  |
| `onCancel` | `(() => void) | undefined` | — |  |
| `children` | `any` | — | Extra controls rendered above the buttons. |

---

## PhotoUpload

**Import:** `$components/data-inputs/photo-upload/PhotoUpload.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keys` | `string[] | undefined` | — | Object keys of the uploaded photos. Bindable. |
| `orgId` | `string` | **required** | The organization the photos are uploaded to. |
| `max` | `number | undefined` | — |  |
| `label` | `string | undefined` | — |  |
| `helperText` | `string | undefined` | — |  |
| `disabled` | `boolean | undefined` | — |  |

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

## RangePicker

**Import:** `$components/data-inputs/range-picker/RangePicker.svelte`

---

## RichTextEditor

**Import:** `$components/data-inputs/rich-text-editor/RichTextEditor.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | undefined` | `''` |  |
| `onchange` | `((markdown: string) => void) | undefined` | — |  |
| `saveStatus` | `"saving" | "saved" | null | undefined` | `null` |  |

---

## SearchBox

**Import:** `$components/data-inputs/searchbox/SearchBox.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `close` | `(() => void) | undefined` | — |  |
| `nav` | `SidebarNavEntry[] | undefined` | `[]` |  |
| `open` | `boolean | undefined` | `false` |  |

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

## TagInput

**Import:** `$components/data-inputs/tag-input/TagInput.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tags` | `string[]` | **required** |  |
| `placeholder` | `string | undefined` | `'Type and press Enter…'` |  |
| `disabled` | `boolean | undefined` | `false` |  |
| `onchange` | `(tags: string[]) => void` | **required** |  |

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
