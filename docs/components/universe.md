# Universe Components

## BucketEntityFilter

**Import:** `$components/universe/bucket-entity-filter/BucketEntityFilter.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filters` | `FilterDefinition[]` | **required** | All available filter definitions the user can choose from |
| `filterId` | `string | undefined` | `$bindable('')` | The currently selected filter field id |
| `qualifierId` | `string | undefined` | `$bindable('')` | The currently selected qualifier value |
| `value` | `string | undefined` | `$bindable('')` | The current filter value string |
| `onremove` | `(() => void) | undefined` | — | Called when the user clicks the remove button |

---

## BucketEntityFilterEditor

**Import:** `$components/universe/bucket-entity-filter-editor/BucketEntityFilterEditor.svelte`

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `entity` | `string` | **required** |  |
| `matchType` | `MatchType | undefined` | `$bindable('ONE_OR_MORE')` |  |
| `filterEntries` | `FilterEntry[] | undefined` | `$bindable([])` | The current list of filter rows. Bindable so parents can read state on submit. |
| `filters` | `FilterDefinition[] | undefined` | `[]` | Available filter definitions for the entity type |

---
