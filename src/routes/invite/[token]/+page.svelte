<script lang="ts">
	import JoinOrgPage from '$pages/invite/JoinOrgPage.svelte';
	const { data } = $props();
</script>

<svelte:head>
	<title>Join {data.orgName}</title>
</svelte:head>

<JoinOrgPage orgName={data.orgName} orgSlug={data.orgSlug} alreadyMember={data.alreadyMember} />
