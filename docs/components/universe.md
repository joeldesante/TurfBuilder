# Universe Components

## BucketFiltersEditor

**Import:** `$components/universe/bucket-filters-editor/BucketFiltersEditor.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filters` | `BucketFilters` | `$bindable()` | What the bucket selects: a filter group for each kind of record it includes, null for each it does not. |
| `orgId` | `string | undefined` | — | The organization whose buckets, lists, and surveys the filters offer. |
| `source` | `FilterSource | undefined` | — | Overrides where those choices come from; for stories and tests. |
| `label` | `string | undefined` | `'This bucket will contain'` | Small text above each editor, saying what the filters are for. |

---

## ContactMadePicker

**Import:** `$components/universe/contact-made-picker/ContactMadePicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `FilterSource | undefined` | — | Where the buckets and lists to choose from come from. Without one, the attempts cannot be limited to a bucket or list. |
| `value` | `ContactMadeValue` | **required** |  |
| `onchange` | `(value: ContactMadeValue) => void` | **required** |  |

---

## ContactSchemaPicker

**Import:** `$components/universe/contact-schema-picker/ContactSchemaPicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `FilterSource` | **required** | Where the organization's contact schemas come from. |
| `value` | `ContactSchemaValue | null` | **required** | The current choice; null until a schema is picked. |
| `onchange` | `(value: ContactSchemaValue) => void` | **required** |  |

---

## CsvColumnMapper

Matches a CSV's columns to what a contact holds. One row for each place a column can go,
with a dropdown of the file's columns to fill it: the coordinates (required) and the
address that every contact has, then the fields of the schema. Every place is on screen
whatever the file contains, so a file with no coordinates shows plainly that they are
still to be mapped.

**Import:** `$components/universe/csv-column-mapper/CsvColumnMapper.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `headers` | `string[]` | **required** | The CSV's column names, in order. |
| `samples` | `string[][]` | **required** | A few rows from the file, to show what each column holds. |
| `fields` | `ContactSchemaField[]` | **required** | The fields of the chosen schema. |
| `schemaName` | `string | undefined` | `'Schema'` | The schema's name, which heads its fields. |
| `mapping` | `ColumnMapping` | **required** | Which column fills each field: the field's id (a schema field's, or a contact data
field's such as `contact.latitude`) to the column's position from 0. A field with no
entry has no column. A column can fill any number of fields. |
| `onchange` | `(mapping: ColumnMapping) => void` | **required** |  |
| `errors` | `Record<string, string[]> | undefined` | `{}` | What is wrong with each field, by `mapping.<field id>`, as a `Form` reports it. The
first message for a field shows under its row. |

---

## DragHandle

**Import:** `$components/universe/drag-handle/DragHandle.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ondragstart` | `(event: DragEvent) => void` | **required** |  |
| `ondragend` | `((event: DragEvent) => void) | undefined` | — |  |

---

## EntityFilterEditor

**Import:** `$components/universe/entity-filter-editor/EntityFilterEditor.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `group` | `FilterGroupValue | undefined` | `$bindable({ operator: 'AND', filters: [] })` | The whole query. It is always a group: the root group is the foundation
of the query and cannot be removed. Bindable so parents can read it on submit. |
| `onchange` | `((group: FilterGroupValue) => void) | undefined` | — | Called with the whole query after each change, for parents that hold it themselves instead of binding. |
| `catalog` | `FilterRegistryEntry[] | undefined` | — | Filters offered in the catalog. Defaults to the full shared registry. |
| `label` | `string | undefined` | — | Small text above the root group's mode, saying what the query is for, such as "This bucket will contain". |
| `entity` | `FilterEntity | undefined` | — | The kind of record the filters select, which their sentences name. Reads as "Records" when not given. |
| `orgId` | `string | undefined` | — | The organization whose buckets, lists, and surveys the filters that name them offer. Without it (or `source`) those filters cannot load their choices. |
| `source` | `FilterSource | undefined` | — | Overrides where those choices come from; defaults to the API for `orgId`. |

---

## FilterCatalog

**Import:** `$components/universe/filter-catalog/FilterCatalog.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** |  |
| `filters` | `FilterRegistryEntry[] | undefined` | — | Filters to offer. Defaults to the full shared registry. |
| `onOpenChange` | `(open: boolean) => void` | **required** |  |
| `onselect` | `((filter: FilterRegistryEntry) => void) | undefined` | — |  |
| `onselectgroup` | `(() => void) | undefined` | — | When given, the catalog also offers a Filter Group to nest filters in. |

---

## FilterConversionDemo

**Import:** `$components/universe/filter-conversion-demo/FilterConversionDemo.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `input` | `BucketFilterInput | undefined` | — | The old filter, as the old bucket form sent it. |

---

## FilterEditModal

**Import:** `$components/universe/filter-edit-modal/FilterEditModal.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** |  |
| `definition` | `FilterRegistryEntry` | **required** |  |
| `filter` | `Filter` | **required** | The filter as it stands. The modal edits a copy; nothing changes until Save. |
| `isNew` | `boolean | undefined` | `false` | A filter that has just been added and not yet saved once. |
| `onsave` | `(filter: Filter) => void` | **required** |  |
| `oncancel` | `() => void` | **required** | Closed without saving. |

---

## FilterGroup

**Import:** `$components/universe/filter-group/FilterGroup.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `group` | `FilterGroupValue` | **required** |  |
| `onchange` | `(group: FilterGroupValue) => void` | **required** |  |
| `onremove` | `(() => void) | undefined` | — | Omit for the root group, which is the foundation of the query and cannot be removed. |
| `catalog` | `FilterRegistryEntry[] | undefined` | — | Filters offered in the catalog. Defaults to the full shared registry. |
| `label` | `string | undefined` | — | Small text above the mode, saying what the query is for, such as "This bucket will contain". |
| `path` | `FilterPath | undefined` | `[]` | Where this group sits in the query. Empty for the root; set by the parent group. |
| `ondragstart` | `((event: DragEvent) => void) | undefined` | — | When given, a grip is shown in the header that starts a drag to reorder this group. |
| `ondragend` | `((event: DragEvent) => void) | undefined` | — |  |

---

## FilterQueryDemo

**Import:** `$components/universe/filter-query-demo/FilterQueryDemo.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `entity` | `FilterEntity | undefined` | `$bindable('locations')` | Which records the query is built for; decides which filters apply. |
| `group` | `FilterGroup | undefined` | `$bindable({ operator: 'AND', filters: [] })` | The tree the editor starts with. |

---

## FilterRow

**Import:** `$components/universe/filter-row/FilterRow.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `definition` | `FilterRegistryEntry` | **required** | The registry entry this row shows; decides its wording and the settings in the editor. |
| `filter` | `Filter` | **required** |  |
| `onchange` | `(filter: Filter) => void` | **required** |  |
| `onremove` | `() => void` | **required** |  |
| `startOpen` | `boolean | undefined` | `false` | Opens the editor as soon as the row appears, for a filter that has just
been added. Cancelling the editor then removes the filter again, since
it was never configured. Read once, when the row is created. |
| `ondragstart` | `((event: DragEvent) => void) | undefined` | — | When given, a grip is shown on the left that starts a drag to reorder the filter. |
| `ondragend` | `((event: DragEvent) => void) | undefined` | — |  |

---

## FilterSentence

**Import:** `$components/universe/filter-sentence/FilterSentence.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `parts` | `SentencePart[]` | **required** |  |
| `onview` | `((kind: NonNullable<SentencePart["view"]>) => void) | undefined` | — | Called when the map button beside a viewable setting is pressed. |
| `onedit` | `(() => void) | undefined` | — | When given, pressing a setting calls it, so the sentence opens its own editor. |

---

## LocationResponseDetail

**Import:** `$components/universe/location-response-detail/LocationResponseDetail.svelte`

---

## MetricsWorkflowSidebar

**Import:** `$components/universe/metrics-workflow-sidebar/MetricsWorkflowSidebar.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `buckets` | `MetricsBucket[]` | **required** |  |
| `onGenerate` | `(selection: MetricsWorkflowSelection) => void` | **required** |  |

---

## PolygonPickerModal

**Import:** `$components/universe/polygon-picker-modal/PolygonPickerModal.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** |  |
| `value` | `import("/Users/joeldesante/Development/TurfBuilder/node_modules/@types/geojso...` | `null` | The region already chosen, if any. |
| `onOpenChange` | `(open: boolean) => void` | **required** |  |
| `onapply` | `(value: GeoJSON.Polygon) => void` | **required** |  |

---

## RadiusPickerModal

**Import:** `$components/universe/radius-picker-modal/RadiusPickerModal.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** |  |
| `value` | `RadiusValue | null | undefined` | `null` | The area already chosen, if any. |
| `onOpenChange` | `(open: boolean) => void` | **required** |  |
| `onapply` | `(value: RadiusValue) => void` | **required** |  |

---

## SchemaFieldPicker

**Import:** `$components/universe/schema-field-picker/SchemaFieldPicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `FilterSource` | **required** | Where the organization's contact schemas, with their fields, come from. |
| `value` | `SchemaFieldValue | null` | **required** | The current choice; null until a schema is picked. |
| `onchange` | `(value: SchemaFieldValue) => void` | **required** |  |
| `ontypechange` | `((type: ContactSchemaFieldType | null) => void) | undefined` | — | Tells the editor what kind of field is chosen, since that decides how it can be compared. Null when none is. |

---

## SurveyResponsePicker

**Import:** `$components/universe/survey-response-picker/SurveyResponsePicker.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `FilterSource` | **required** | Where the buckets, surveys, and questions come from. |
| `value` | `SurveyResponseValue | null` | **required** | The current choice; null until a bucket is picked. |
| `onchange` | `(value: SurveyResponseValue) => void` | **required** |  |
| `needsResponse` | `boolean | undefined` | `true` | False when the filter only asks whether the question was answered, so there is no response to pick. |

---
