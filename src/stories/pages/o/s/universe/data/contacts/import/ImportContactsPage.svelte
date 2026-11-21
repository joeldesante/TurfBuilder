<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import CsvColumnMapper from '$components/universe/csv-column-mapper/CsvColumnMapper.svelte';
	import VirtualDataGrid from '$components/data-display/virtual-data-grid/VirtualDataGrid.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import DataTable, {
		type DataTableColumn
	} from '$components/data-display/data-table/DataTable.svelte';
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import FileDropzone from '$components/data-inputs/file-dropzone/FileDropzone.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import { readCsvPreview, type CsvPreview } from '$lib/client/csv-preview';
	import { createCsvRowSource, fileReader, urlReader, type RowSource } from '$lib/client/csv-rows';
	import type { CsvIndex } from '$lib/shared/utils/csv-index';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import {
		mapTargets,
		mappingFormSchema,
		suggestMapping,
		type ColumnMapping
	} from '$lib/shared/utils/csv-mapping';
	import { mappingFits, type ImportViewState } from '$lib/shared/utils/import-state';
	import type { ContactSchema } from '$lib/shared/types/contact-schemas';
	import type { ContactImportFile, ContactImportRowIndex } from '$lib/shared/types/contact-imports';
	import { formatMegabytes } from '$lib/shared/utils/format-bytes';
	import { formatDate, formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		orgSlug: string;
		/** The organization's contact schemas, to choose where the contacts go. */
		schemas?: ContactSchema[];
		/** False when the software is not set up for uploads. The drop zone is then replaced by a notice. @default true */
		available?: boolean;
		/**
		 * Returns a link to read an already uploaded file from, and where its rows start (null
		 * when that was never recorded), for its Load button. Asked again for a fresh link when
		 * the first expires. Without it the button is not shown.
		 */
		onLoadImport?: (
			file: ContactImportFile
		) => Promise<{ url: string; rowIndex: ContactImportRowIndex | null }>;
		/**
		 * Archives an uploaded file: takes it off the list without removing it from storage.
		 * Without it the Archive button is not shown.
		 */
		onArchiveImport?: (file: ContactImportFile) => Promise<void>;
		/** Files already uploaded, newest first, listed under the drop zone. */
		imports?: ContactImportFile[];
		/**
		 * Sends the dropped CSV to storage. Call `onProgress` with 0 to 100 as it goes. Resolve
		 * with the import's id, so the place in the importer can be kept in the address, and the
		 * file's row index when it was made, which lets the Spreadsheet tab read any rows of the
		 * file by position; without it the tab shows the rows read at upload.
		 */
		onUpload?: (
			file: File,
			onProgress: (percent: number) => void
		) => Promise<{ importId: string; index: CsvIndex } | void>;
		/** Where the person was when the page loaded, from the address. The page picks up there. */
		restore?: ImportViewState | null;
		/** Called when the place in the importer changes, so it can be kept in the address. Null on the first step. */
		onStateChange?: (state: ImportViewState | null) => void;
		/**
		 * Called when Begin Import is pressed, with the uploaded file's id, the chosen schema and
		 * which column fills each field: a schema field's id or a contact data field's id
		 * (`contact.latitude`) to the column's position from 0. A column can fill several fields,
		 * and a field left out has no entry. The coordinates and every required field are mapped
		 * by then. The button shows a spinner until this settles. Without it, or when the upload
		 * reported no id, Begin Import does nothing.
		 */
		onBeginImport?: (input: {
			importId: string;
			schemaId: string;
			mapping: ColumnMapping;
		}) => void | Promise<void>;
	}

	const {
		orgSlug,
		schemas = [],
		imports = [],
		available = true,
		onUpload,
		onLoadImport,
		onArchiveImport,
		restore = null,
		onStateChange,
		onBeginImport
	}: Props = $props();

	const importColumns = $derived<DataTableColumn<ContactImportFile>[]>([
		{ id: 'file_name', accessorKey: 'file_name', header: 'File', class: 'break-all' },
		{
			id: 'row_count',
			header: 'Rows',
			align: 'right',
			tabular: true,
			accessorFn: (file) => (file.row_count === null ? '—' : file.row_count.toLocaleString())
		},
		{
			id: 'size_bytes',
			header: 'Size',
			align: 'right',
			tabular: true,
			nowrap: true,
			accessorFn: (file) => formatMegabytes(file.size_bytes)
		},
		{
			id: 'uploaded_at',
			header: 'Uploaded',
			nowrap: true,
			accessorFn: (file) => formatDateTime(file.uploaded_at)
		},
		{ id: 'expires_at', header: 'Expires', nowrap: true, cell: expiresCell },
		...(onLoadImport || onArchiveImport
			? [
					{
						id: 'actions',
						header: 'Actions',
						srOnlyHeader: true,
						align: 'right' as const,
						cell: actionsCell
					}
				]
			: [])
	]);

	/** Whether a file's purge date has passed. */
	function isExpired(file: ContactImportFile): boolean {
		return !file.preserved && new Date(file.expires_at).getTime() <= Date.now();
	}

	let step = $state<1 | 2>(1);
	let tab = $state<'mapping' | 'spreadsheet'>('mapping');
	const stepTwoTabs = [
		{ id: 'mapping', label: 'Mapping' },
		{ id: 'spreadsheet', label: 'Spreadsheet' }
	];
	let preview = $state<CsvPreview | null>(null);
	let schemaId = $state('');
	/**
	 * The mapping for the chosen schema, held in a form whose rules are that every required field has
	 * a column. A new one is made whenever the schema or the file changes, since both set the rules.
	 */
	let form = $state<Form<ReturnType<typeof mappingFormSchema>> | null>(null);
	/** Which column fills each field. */
	const mapping = $derived<ColumnMapping>(form?.values.mapping ?? {});

	const schema = $derived(schemas.find((s) => s.id === schemaId));
	/** Reads rows of the file by position, for the Spreadsheet tab. Null when the file has no row index. */
	let rowSource = $state<RowSource | null>(null);

	/** What the Spreadsheet tab reads from: the whole file when it can be, else the few rows read at upload. */
	const gridRows = $derived(
		rowSource
			? rowSource.loadRows
			: async (offset: number, limit: number) =>
					preview?.samples.slice(offset, offset + limit) ?? []
	);
	const gridRowCount = $derived(rowSource?.rowCount ?? preview?.samples.length ?? 0);

	/** Ready once every required field has a column. */
	const canBegin = $derived(form?.valid ?? false);

	/** Uploads the file, then reads its columns and moves on to mapping them. */
	async function handleUpload(file: File, onProgress: (percent: number) => void) {
		const uploaded = await onUpload?.(file, onProgress);
		const index = uploaded?.index;
		const columns = await readCsvPreview(file);
		// The file is in hand, so its rows are read from it, not fetched back from storage.
		openMapping(
			columns,
			index
				? createCsvRowSource({
						columnCount: columns.headers.length,
						rowCount: index.rowCount,
						index: { interval: index.interval, offsets: index.offsets },
						size: file.size,
						read: fileReader(file)
					})
				: null
		);
		importId = uploaded?.importId ?? null;
	}

	/** The uploaded file whose columns are on screen, which is what the address keeps. */
	let importId = $state<string | null>(null);

	/** True from the start while a place kept in the address is being picked up again. */
	let restoring = $state(
		untrack(
			() => restore !== null && !!onLoadImport && imports.some((file) => file.id === restore.fileId)
		)
	);

	/** Moves on to mapping the columns of a file, whether just uploaded or loaded from the list. */
	function openMapping(columns: CsvPreview, source: RowSource | null) {
		preview = columns;
		rowSource = source;
		chooseSchema(schemas.length === 1 ? schemas[0].id : '');
		tab = 'mapping';
		step = 2;
	}

	/** Files archived this visit. They leave the list the moment Archive is pressed, before the server has answered. */
	let archivedIds = $state<string[]>([]);

	/** The files still listed. */
	const listedImports = $derived(imports.filter((file) => !archivedIds.includes(file.id)));

	/**
	 * Takes a file off the list. The row goes at once and comes back only if the archive
	 * fails, since archiving is a quick mark on the record and rarely fails. The file
	 * stays in storage.
	 */
	async function handleArchive(file: ContactImportFile) {
		const archive = onArchiveImport;
		if (!archive || archivedIds.includes(file.id)) return;
		archivedIds = [...archivedIds, file.id];
		try {
			await archive(file);
			toast.success('File archived.');
		} catch {
			archivedIds = archivedIds.filter((id) => id !== file.id);
			toast.error('The file could not be archived.');
		}
	}

	/** The file whose Load button was pressed, until its columns have been read. */
	let loadingImportId = $state<string | null>(null);

	/** Reads an already uploaded file back from storage and moves on to mapping its columns. */
	async function handleLoadImport(file: ContactImportFile, kept: ImportViewState | null = null) {
		const load = onLoadImport;
		if (!load || loadingImportId !== null) return;
		loadingImportId = file.id;
		try {
			const first = await load(file);
			const columns = await readCsvPreview(first.url);
			let url = first.url;
			openMapping(
				columns,
				first.rowIndex && file.row_count !== null
					? createCsvRowSource({
							columnCount: columns.headers.length,
							rowCount: file.row_count,
							index: first.rowIndex,
							size: file.size_bytes,
							// Links expire after a few minutes, so a fresh one is asked for when this one is refused.
							read: urlReader(async (refresh) => {
								if (refresh) url = (await load(file)).url;
								return url;
							})
						})
					: null
			);
			importId = file.id;
			if (kept) applyKept(kept, columns.headers.length);
		} catch {
			toast.error('The file could not be loaded.');
		} finally {
			loadingImportId = null;
		}
	}

	/** Puts back the tab, schema and column mapping kept in the address, as far as they still fit. */
	function applyKept(kept: ImportViewState, columnCount: number) {
		tab = kept.tab;
		const chosen = schemas.find((s) => s.id === kept.schemaId);
		if (!chosen) return;
		chooseSchema(chosen.id);
		// A column can go to a field of the schema or to contact data, such as the coordinates.
		const fieldIds = mapTargets(chosen.fields).map((t) => t.id);
		if (form && kept.mapping && mappingFits(kept.mapping, columnCount, fieldIds)) {
			form.values.mapping = kept.mapping;
			form.validate();
		}
	}

	// Picks up where the address says the person was, once, as the page opens.
	onMount(() => {
		if (!restoring || !restore) return;
		const file = imports.find((f) => f.id === restore.fileId);
		if (!file) {
			restoring = false;
			return;
		}
		handleLoadImport(file, restore).finally(() => (restoring = false));
	});

	// Keeps the place in the importer in the address. Held back while picking it up, so
	// the first render does not wipe what is being restored.
	$effect(() => {
		if (!onStateChange || restoring) return;
		if (step === 2 && importId && preview) {
			onStateChange({ fileId: importId, tab, schemaId, mapping: { ...mapping } });
		} else {
			onStateChange(null);
		}
	});

	function chooseSchema(next: string) {
		schemaId = next;
		const chosen = schemas.find((s) => s.id === next);
		if (!chosen || !preview) {
			form = null;
			return;
		}
		form = new Form(
			mappingFormSchema(chosen.fields, preview.headers.length),
			// Runs only when every rule is met, with the mapping as the rules cleaned it.
			async ({ mapping: chosen }) => {
				if (!importId) return;
				await onBeginImport?.({ importId, schemaId, mapping: chosen });
			},
			{ mapping: suggestMapping(preview.headers, chosen.fields) }
		);
		form.validate();
	}

	function startOver() {
		step = 1;
		importId = null;
		preview = null;
		rowSource = null;
		schemaId = '';
		form = null;
	}
</script>

{#snippet actionsCell({ row }: { value: unknown; row: ContactImportFile })}
	<div class="flex items-center justify-end gap-1">
		{#if onLoadImport}
			<Button
				variant="outline"
				size="sm"
				aria-label="Load {row.file_name}"
				loading={loadingImportId === row.id}
				disabled={isExpired(row) || (loadingImportId !== null && loadingImportId !== row.id)}
				onclick={() => handleLoadImport(row)}
			>
				Load
			</Button>
		{/if}
		{#if onArchiveImport}
			<Tooltip text="Archive" side="top" delayDuration={200}>
				{#snippet trigger(props)}
					<Button
						{...props}
						variant="ghost"
						size="sm"
						iconOnly
						aria-label="Archive {row.file_name}"
						onclick={() => handleArchive(row)}
					>
						<TrashIcon />
					</Button>
				{/snippet}
			</Tooltip>
		{/if}
	</div>
{/snippet}

{#snippet expiresCell({ row }: { value: unknown; row: ContactImportFile })}
	{#if row.preserved}
		<Badge size="sm" variant="info">Kept</Badge>
	{:else if isExpired(row)}
		<span class="text-on-surface-subtle">Expired</span>
	{:else}
		{formatDate(row.expires_at)}
	{/if}
{/snippet}

<!-- Fills the height of the page, so the Spreadsheet tab can take the space under the tabs. -->
<div class="flex h-full flex-col">
	<div class="flex shrink-0 items-center gap-2 pt-2 lg:pt-4 pb-2 lg:pb-6">
		{#if available && step === 2 && preview}
			<!-- On step 2 back goes to step 1, not out of the importer. -->
			<Button
				variant="ghost"
				iconOnly
				aria-label="Back to upload"
				onclick={startOver}
				class="shrink-0 text-on-surface-subtle hover:text-on-surface"
			>
				<ArrowLeftIcon />
			</Button>
		{:else}
			<Button
				href="/o/{orgSlug}/s/universe/data/contacts"
				variant="ghost"
				iconOnly
				aria-label="Back to Contacts"
				class="shrink-0 text-on-surface-subtle hover:text-on-surface"
			>
				<ArrowLeftIcon />
			</Button>
		{/if}
		<PageHeader title="Import Contacts" class="!py-0 min-w-0 flex-1">
			{#snippet actions()}
				{#if available}
					<Button
						href="/o/{orgSlug}/s/universe/data/contacts/import/active"
						variant="outline"
						size="sm"
					>
						Active imports
					</Button>
				{/if}
			{/snippet}
		</PageHeader>
	</div>

	<div class="min-h-0 w-full flex-1 overflow-y-auto">
		{#if !available}
			<!-- Stands in for the drop zone. The wording is vague on purpose. -->
			<div
				role="alert"
				data-testid="import-unavailable"
				class="flex justify-center px-6 py-12 text-center"
			>
				<p class="max-w-md text-base text-on-surface">
					This feature is disabled because the software is not yet configured to support it. Please
					contact your administrator.
				</p>
			</div>
		{:else if restoring}
			<p role="status" class="py-12 text-center text-sm text-on-surface-subtle">
				Loading your file...
			</p>
		{:else if step === 1 || !preview}
			<p class="pb-3 text-sm text-on-surface-subtle">Step 1 of 2: Upload a file</p>
			<FileDropzone onUpload={handleUpload} />

			<section class="flex flex-col gap-3 pt-8" aria-labelledby="uploaded-files-heading">
				<h2 id="uploaded-files-heading" class="text-base font-semibold text-on-surface">
					Uploaded files
				</h2>
				<DataTable
					data={listedImports}
					columns={importColumns}
					getRowId={(file) => file.id}
					label="Uploaded files"
					empty="No files uploaded yet."
				/>
				<p class="text-sm text-on-surface-subtle">
					Files are removed from storage on their expiry date unless they are kept.
				</p>
			</section>
		{:else}
			<div class="flex h-full min-h-0 flex-col gap-4">
				<div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
					<Tabs
						tabs={stepTwoTabs}
						active={tab}
						label="Import views"
						onSelect={(id) => (tab = id as typeof tab)}
					/>
					<Button variant="ghost" size="sm" onclick={startOver}>Choose a different file</Button>
				</div>

				{#if tab === 'mapping'}
					<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
						{#if schemas.length === 0}
							<p class="text-sm text-on-surface">
								There are no contact schemas yet. Create one under
								<a href="/o/{orgSlug}/s/universe/data/contact-schemas">Contact schemas</a>, then
								come back.
							</p>
						{:else}
							<div class="flex flex-wrap items-center gap-3">
								<span class="text-sm font-medium text-on-surface">Import into</span>
								<Dropdown
									class="w-64 max-w-full"
									aria-label="Schema"
									placeholder="Choose schema"
									items={schemas.map((s) => ({ value: s.id, label: s.schema_name }))}
									value={schemaId}
									onValueChange={chooseSchema}
								/>
							</div>

							{#if schema}
								<CsvColumnMapper
									headers={preview.headers}
									samples={preview.samples}
									fields={schema.fields}
									schemaName={schema.schema_name}
									{mapping}
									errors={form?.errors ?? {}}
									onchange={(next) => {
										if (!form) return;
										form.values.mapping = next;
										form.validate();
									}}
								/>
								<div>
									<Button
										disabled={!canBegin}
										loading={form?.submitting}
										onclick={() => form?.submit()}>Begin Import</Button
									>
								</div>
							{/if}
						{/if}
					</div>
				{:else}
					<div class="min-h-0 flex-1">
						{#key preview}
							<VirtualDataGrid
								fill
								pageJumper
								columns={preview.headers}
								totalRows={gridRowCount}
								loadRows={gridRows}
							/>
						{/key}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
