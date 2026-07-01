<script module lang="ts">
	export const meta = {
		title: 'Pages/O/S/Universe/Data/Locations/Import/Overture'
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import OvertureImportPage from './OvertureImportPage.svelte';
	import type { ImportProgress } from './OvertureImportPage.svelte';

	async function* mockImportSuccess(): AsyncGenerator<ImportProgress> {
		yield { stage: 'querying' };
		await new Promise((r) => setTimeout(r, 800));
		yield { stage: 'uploading', batch: 1, total: 3 };
		await new Promise((r) => setTimeout(r, 400));
		yield { stage: 'uploading', batch: 2, total: 3 };
		await new Promise((r) => setTimeout(r, 400));
		yield { stage: 'uploading', batch: 3, total: 3 };
		await new Promise((r) => setTimeout(r, 400));
		yield { stage: 'done', result: { imported: 542, skipped: 0, errors: [] } };
	}

	async function* mockImportWithErrors(): AsyncGenerator<ImportProgress> {
		yield { stage: 'querying' };
		await new Promise((r) => setTimeout(r, 600));
		yield { stage: 'uploading', batch: 1, total: 1 };
		await new Promise((r) => setTimeout(r, 400));
		yield {
			stage: 'done',
			result: {
				imported: 18,
				skipped: 2,
				errors: [
					{ row: 4, reason: 'Database insert failed' },
					{ row: 11, reason: 'Database insert failed' }
				]
			}
		};
	}
</script>

<Story name="Default">
	<OvertureImportPage orgSlug="demo-org" onImport={mockImportSuccess} />
</Story>

<Story name="With Errors">
	<OvertureImportPage orgSlug="demo-org" onImport={mockImportWithErrors} />
</Story>
