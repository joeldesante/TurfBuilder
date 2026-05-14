<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	// --- Draft types (UI state, all values are strings) ---

	interface WhereConditionDraft {
		type: 'condition';
		column: string;
		op: string;
		negate: boolean;
		value: string;
		value2: string;
	}

	interface WhereGroupDraft {
		type: 'group';
		connector: 'AND' | 'OR';
		negate: boolean;
		children: WhereNodeDraft[];
	}

	type WhereNodeDraft = WhereConditionDraft | WhereGroupDraft;

	interface JoinDraft {
		type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
		table: string;
		leftColumn: string;
		op: string;
		rightColumn: string;
	}

	interface QueryDraft {
		from: string;
		select: string[];
		selectInput: string;
		joins: JoinDraft[];
		where: WhereGroupDraft;
	}

	interface QueryResult {
		fields: string[];
		rows: Record<string, unknown>[];
	}

	interface Props {
		orgSlug: string;
		tableSchemas?: import('$lib/server/db-introspection').TableSchema[];
	}

	const { orgSlug, tableSchemas = [] }: Props = $props();

	let showSchema = $state(false);

	const OPERATORS = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IN', 'BETWEEN'];
	const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const;
	const JOIN_OPS = ['=', '!=', '<', '>', '<=', '>='];

	function newJoin(): JoinDraft {
		return { type: 'INNER', table: '', leftColumn: '', op: '=', rightColumn: '' };
	}

	function newCondition(): WhereConditionDraft {
		return { type: 'condition', column: '', op: '=', negate: false, value: '', value2: '' };
	}

	function newGroup(): WhereGroupDraft {
		return { type: 'group', connector: 'AND', negate: false, children: [] };
	}

	let queries = $state<QueryDraft[]>([
		{ from: '', select: [], selectInput: '', joins: [], where: newGroup() }
	]);

	let results = $state<QueryResult[] | null>(null);
	let running = $state(false);
	let errorMessage = $state<string | null>(null);
	let showSql = $state(false);

	function addQuery() {
		queries.push({ from: '', select: [], selectInput: '', joins: [], where: newGroup() });
	}

	function removeQuery(qi: number) {
		queries.splice(qi, 1);
	}

	function addColumn(qi: number) {
		const col = queries[qi].selectInput.trim();
		if (col && !queries[qi].select.includes(col)) {
			queries[qi].select.push(col);
		}
		queries[qi].selectInput = '';
	}

	function removeColumn(qi: number, col: string) {
		queries[qi].select = queries[qi].select.filter((c) => c !== col);
	}

	function handleColumnKeydown(e: KeyboardEvent, qi: number) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addColumn(qi);
		}
	}

	// --- Serialization: convert draft tree → API payload ---

	function serializeNode(node: WhereNodeDraft): unknown {
		if (node.type === 'condition') {
			if (!node.column) return null;
			if (node.op === 'IN') {
				const values = node.value.split(',').map((v) => v.trim()).filter(Boolean);
				if (values.length === 0) return null;
				return { type: 'condition', column: node.column, op: node.op, negate: node.negate, value: values };
			}
			if (node.op === 'BETWEEN') {
				if (!node.value || !node.value2) return null;
				return { type: 'condition', column: node.column, op: node.op, negate: node.negate, value: node.value, value2: node.value2 };
			}
			if (!node.value) return null;
			return { type: 'condition', column: node.column, op: node.op, negate: node.negate, value: node.value };
		}
		const children = node.children.map(serializeNode).filter(Boolean);
		if (children.length === 0) return null;
		return { type: 'group', connector: node.connector, negate: node.negate, children };
	}

	async function run() {
		running = true;
		errorMessage = null;
		results = null;
		try {
			const payload = {
				queries: queries.map((q) => {
					const where = serializeNode(q.where);
					const joins = q.joins
						.filter((j) => j.table && j.leftColumn && j.rightColumn)
						.map((j) => ({
							type: j.type,
							table: j.table,
							on: { leftColumn: j.leftColumn, op: j.op, rightColumn: j.rightColumn }
						}));
					return {
						select: q.select,
						from: q.from,
						...(joins.length > 0 ? { joins } : {}),
						...(where ? { where } : {})
					};
				})
			};
			const res = await fetch(`/o/${orgSlug}/s/api/query`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message ?? 'Query failed.');
			}
			const data = await res.json();
			results = data.results;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Unknown error.';
		} finally {
			running = false;
		}
	}

	let canRun = $derived(
		queries.length > 0 &&
			queries.every((q) => q.from.trim().length > 0 && q.select.length > 0)
	);

	// --- SQL preview (mirrors server logic, no DB access) ---

	function buildSqlNode(node: WhereNodeDraft, paramIdx: { v: number }): string {
		if (node.type === 'condition') {
			const i = paramIdx.v;
			let sql: string;
			if (node.op === 'IN') {
				const values = node.value.split(',').map((v) => v.trim()).filter(Boolean);
				const placeholders = values.length > 0
					? values.map((_, j) => `$${i + j}`).join(', ')
					: '?';
				sql = `${node.column || '<col>'} IN (${placeholders})`;
				paramIdx.v += Math.max(values.length, 1);
			} else if (node.op === 'BETWEEN') {
				sql = `${node.column || '<col>'} BETWEEN $${i} AND $${i + 1}`;
				paramIdx.v += 2;
			} else {
				sql = `${node.column || '<col>'} ${node.op} $${i}`;
				paramIdx.v += 1;
			}
			return node.negate ? `NOT (${sql})` : sql;
		}
		const parts = node.children.map((child) => buildSqlNode(child, paramIdx)).filter(Boolean);
		if (parts.length === 0) return '';
		const inner = parts.join(` ${node.connector} `);
		const grouped = parts.length > 1 ? `(${inner})` : inner;
		return node.negate ? `NOT ${grouped}` : grouped;
	}

	function buildSql(query: QueryDraft): string {
		const columns = query.select.length > 0 ? query.select.join(', ') : '*';
		let sql = `SELECT ${columns} FROM ${query.from || '<table>'}`;
		for (const j of query.joins) {
			if (j.table) {
				sql += `\n${j.type} JOIN ${j.table || '<table>'} ON ${j.leftColumn || '<col>'} ${j.op} ${j.rightColumn || '<col>'}`;
			}
		}
		const paramIdx = { v: 1 };
		const whereStr = buildSqlNode(query.where, paramIdx);
		if (whereStr) sql += `\nWHERE ${whereStr}`;
		return sql + ';';
	}

	let previewSql = $derived(queries.map(buildSql).join('\n\n'));
</script>

<PageHeader title="Quick Search" subheading="Build and run queries against your universe data." />

<!--
	Snippets are defined here and referenced in the query cards below.
	conditionRow and groupBlock are mutually recursive via groupBlock calling itself.
-->

{#snippet conditionRow(condition: WhereConditionDraft, onRemove: () => void)}
	<div class="flex flex-wrap gap-2 items-center py-1">
		<label class="flex items-center gap-1 text-xs text-on-surface-subtle select-none">
			<input type="checkbox" bind:checked={condition.negate} />
			NOT
		</label>
		<input
			class="w-28 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
			placeholder="column"
			bind:value={condition.column}
		/>
		<select
			class="rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
			bind:value={condition.op}
		>
			{#each OPERATORS as op}
				<option value={op}>{op}</option>
			{/each}
		</select>
		{#if condition.op === 'BETWEEN'}
			<input
				class="w-24 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="from"
				bind:value={condition.value}
			/>
			<span class="text-xs text-on-surface-subtle">and</span>
			<input
				class="w-24 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="to"
				bind:value={condition.value2}
			/>
		{:else if condition.op === 'IN'}
			<input
				class="flex-1 min-w-32 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="a, b, c"
				bind:value={condition.value}
			/>
		{:else}
			<input
				class="flex-1 min-w-32 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="value"
				bind:value={condition.value}
			/>
		{/if}
		<button
			class="text-error hover:text-error/70 text-sm px-1 leading-none"
			onclick={onRemove}
			aria-label="Remove condition"
		>
			&times;
		</button>
	</div>
{/snippet}

{#snippet groupBlock(group: WhereGroupDraft, depth: number, onRemove?: () => void)}
	<div class="{depth > 0 ? 'border border-outline/50 rounded-md p-2 bg-surface' : ''}">
		<div class="flex flex-wrap gap-2 items-center {group.children.length > 0 ? 'mb-2' : ''}">
			<select
				class="rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
				bind:value={group.connector}
			>
				<option value="AND">AND</option>
				<option value="OR">OR</option>
			</select>
			<label class="flex items-center gap-1 text-xs text-on-surface-subtle select-none">
				<input type="checkbox" bind:checked={group.negate} />
				NOT
			</label>
			<button
				class="text-xs text-primary hover:underline"
				onclick={() => group.children.push(newCondition())}
			>
				+ Condition
			</button>
			<button
				class="text-xs text-primary hover:underline"
				onclick={() => group.children.push(newGroup())}
			>
				+ Group
			</button>
			{#if onRemove}
				<button class="text-xs text-error hover:underline" onclick={onRemove}>
					Remove Group
				</button>
			{/if}
		</div>
		{#if group.children.length > 0}
			<div class="{depth > 0 ? 'ml-2 pl-3 border-l border-outline/40' : ''} space-y-1.5">
				{#each group.children as child, ci}
					{#if child.type === 'condition'}
						{@render conditionRow(child as WhereConditionDraft, () => group.children.splice(ci, 1))}
					{:else}
						{@render groupBlock(child as WhereGroupDraft, depth + 1, () => group.children.splice(ci, 1))}
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="p-6 space-y-6 max-w-4xl">
	{#each queries as query, qi}
		<div class="rounded-lg border border-outline bg-surface-container-low overflow-hidden">
			<div class="flex items-center justify-between px-4 py-3 border-b border-outline bg-surface-container">
				<span class="text-sm font-medium text-on-surface">Query {qi + 1}</span>
				{#if queries.length > 1}
					<button class="text-xs text-error hover:underline" onclick={() => removeQuery(qi)}>
						Remove
					</button>
				{/if}
			</div>

			<div class="p-4 space-y-4">
				<!-- FROM -->
				<div class="space-y-1">
					<label
						class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide"
						for="from-{qi}"
					>
						From
					</label>
					<input
						id="from-{qi}"
						class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
						placeholder="table_name"
						bind:value={query.from}
					/>
				</div>

				<!-- SELECT -->
				<div class="space-y-1">
					<p class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Select</p>
					<div class="flex gap-2">
						<input
							class="flex-1 rounded-md border border-outline bg-surface px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
							placeholder="column_name"
							bind:value={query.selectInput}
							onkeydown={(e) => handleColumnKeydown(e, qi)}
						/>
						<button
							class="rounded-md border border-outline px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
							onclick={() => addColumn(qi)}
						>
							Add
						</button>
					</div>
					{#if query.select.length > 0}
						<div class="flex flex-wrap gap-1.5 pt-1">
							{#each query.select as col}
								<span
									class="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary"
								>
									{col}
									<button
										class="text-primary/60 hover:text-primary"
										onclick={() => removeColumn(qi, col)}
										aria-label="Remove {col}"
									>
										&times;
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- JOINS -->
				<div class="space-y-1">
					<div class="flex items-center justify-between">
						<p class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Joins</p>
						<button
							class="text-xs text-primary hover:underline"
							onclick={() => query.joins.push(newJoin())}
						>
							+ Add Join
						</button>
					</div>
					{#if query.joins.length > 0}
						<div class="space-y-2 pt-1">
							{#each query.joins as join, ji}
								<div class="flex flex-wrap gap-2 items-center">
									<select
										class="rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
										bind:value={join.type}
									>
										{#each JOIN_TYPES as t}
											<option value={t}>{t}</option>
										{/each}
									</select>
									<input
										class="w-32 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
										placeholder="table"
										bind:value={join.table}
									/>
									<span class="text-xs text-on-surface-subtle">ON</span>
									<input
										class="w-28 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
										placeholder="left_col"
										bind:value={join.leftColumn}
									/>
									<select
										class="rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
										bind:value={join.op}
									>
										{#each JOIN_OPS as op}
											<option value={op}>{op}</option>
										{/each}
									</select>
									<input
										class="w-28 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
										placeholder="right_col"
										bind:value={join.rightColumn}
									/>
									<button
										class="text-error hover:text-error/70 text-sm px-1 leading-none"
										onclick={() => query.joins.splice(ji, 1)}
										aria-label="Remove join"
									>
										&times;
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- WHERE -->
				<div class="space-y-1">
					<p class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Where</p>
					{@render groupBlock(query.where, 0)}
				</div>
			</div>
		</div>
	{/each}

	<div class="flex gap-3">
		<button
			class="rounded-md border border-outline px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
			onclick={addQuery}
		>
			+ Add Query
		</button>
		<button
			class="rounded-md border border-outline px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
			onclick={() => (showSql = !showSql)}
		>
			{showSql ? 'Hide SQL' : 'Show SQL'}
		</button>
		{#if tableSchemas.length > 0}
			<button
				class="rounded-md border border-outline px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
				onclick={() => (showSchema = !showSchema)}
			>
				{showSchema ? 'Hide Schema' : 'Schema Browser'}
			</button>
		{/if}
		<button
			class="rounded-md bg-primary px-6 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
			disabled={!canRun || running}
			onclick={run}
		>
			{running ? 'Running...' : 'Run'}
		</button>
	</div>

	{#if showSql}
		<pre class="rounded-lg border border-outline bg-surface-container-low px-4 py-3 text-xs font-mono text-on-surface whitespace-pre-wrap overflow-x-auto">{previewSql}</pre>
	{/if}

	{#if showSchema}
		<div class="rounded-lg border border-outline overflow-hidden">
			<div class="px-4 py-3 bg-surface-container border-b border-outline">
				<p class="text-sm font-medium text-on-surface">Schema Browser</p>
				<p class="text-xs text-on-surface-subtle mt-0.5">{tableSchemas.length} tables across {[...new Set(tableSchemas.map(t => t.schema))].join(', ')} schemas</p>
			</div>
			<div class="divide-y divide-outline">
				{#each tableSchemas as table}
					<details class="group">
						<summary class="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-surface-container-low list-none">
							<div class="flex items-center gap-2">
								<span class="text-xs font-mono text-on-surface-subtle">{table.schema}.</span><span class="text-sm font-mono font-medium text-on-surface">{table.name}</span>
							</div>
							<span class="text-xs text-on-surface-subtle">{table.columns.length} cols</span>
						</summary>
						<div class="px-4 pb-3 pt-1 bg-surface-container-low">
							<table class="w-full text-xs font-mono">
								<thead>
									<tr class="text-left text-on-surface-subtle">
										<th class="pb-1 font-medium pr-6">column</th>
										<th class="pb-1 font-medium pr-6">type</th>
										<th class="pb-1 font-medium">nullable</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-outline/50">
									{#each table.columns as col}
										<tr>
											<td class="py-1 pr-6 text-on-surface">{col.name}</td>
											<td class="py-1 pr-6 text-on-surface-subtle">{col.type}</td>
											<td class="py-1 text-on-surface-subtle">{col.nullable ? 'yes' : 'no'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</details>
				{/each}
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error font-mono">
			{errorMessage}
		</div>
	{/if}

	{#if results}
		<div class="space-y-4">
			{#each results as result, i}
				<div>
					<p class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide mb-2">
						Result {i + 1} — {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
					</p>
					{#if result.rows.length === 0}
						<div
							class="rounded-lg border border-outline px-4 py-6 text-center text-sm text-on-surface-subtle"
						>
							No rows returned.
						</div>
					{:else}
						<div class="rounded-lg border border-outline overflow-x-auto">
							<table class="w-full text-sm">
								<thead class="bg-surface-container border-b border-outline">
									<tr>
										{#each result.fields as field}
											<th
												class="px-4 py-2 text-left text-xs font-medium text-on-surface-subtle font-mono whitespace-nowrap"
											>
												{field}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody class="divide-y divide-outline">
									{#each result.rows as row}
										<tr class="hover:bg-surface-container-low">
											{#each result.fields as field}
												<td class="px-4 py-2 text-xs font-mono text-on-surface whitespace-nowrap">
													{row[field] ?? ''}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
