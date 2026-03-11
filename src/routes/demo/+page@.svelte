<script lang="ts">
	import AdaptiveDataGrid, {
		type Column
	} from '$components/data-display/adaptive-datagrid/AdaptiveDataGrid.svelte';

	const columns: Column[] = [
		{ key: 'id', label: 'ID', width: 60 },
		{ key: 'first_name', label: 'First Name', width: 120 },
		{ key: 'last_name', label: 'Last Name', width: 120 },
		{ key: 'email', label: 'Email', width: 200 },
		{ key: 'role', label: 'Role', width: 120 },
		{ key: 'department', label: 'Department', width: 140 },
		{ key: 'status', label: 'Status', width: 100 }
	];

	const PAGE_SIZE = 100;
	const TOTAL_RECORDS = 5000;

	function makeRows(from: number, count: number) {
		return Array.from({ length: count }, (_, i) => {
			const idx = from + i;
			return {
				id: idx + 1,
				first_name: ['Alice', 'Bob', 'Carol', 'David', 'Eve'][idx % 5],
				last_name: ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor'][idx % 5],
				email: `user${idx + 1}@example.com`,
				role: ['Admin', 'Editor', 'Viewer'][idx % 3],
				department: ['Engineering', 'Design', 'Marketing', 'Sales'][idx % 4],
				status: idx % 7 === 0 ? 'Inactive' : 'Active'
			};
		});
	}

	let data = $state(makeRows(0, PAGE_SIZE));
	let loading = $state(false);

	async function handleLoadMore() {
		if (data.length >= TOTAL_RECORDS) return;
		loading = true;
		// Simulate network latency
		await new Promise((r) => setTimeout(r, 600));
		data = [...data, ...makeRows(data.length, Math.min(PAGE_SIZE, TOTAL_RECORDS - data.length))];
		loading = false;
	}

	function handleChange(rowIndex: number, key: string, value: string) {
		console.log(`Row ${rowIndex} — ${key}: "${value}"`);
	}
</script>

<div class="agdcontainer">
	<AdaptiveDataGrid
		{columns}
		{data}
		{loading}
		onchange={handleChange}
		onloadmore={handleLoadMore}
		readonly={true}
	/>
</div>

<style>
	:global(html, body) {
		overscroll-behavior: none;
	}

	.agdcontainer {
		width: 100vw;
		height: 100vh;
		--adg-height: 100%;
		overscroll-behavior: none;
	}
</style>
