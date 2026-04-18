<template>
	<div class="root">
		<img src="/logo-text.svg" alt="TurfBuilder">
	</div>
</template>

<style lang="css" scoped>
	.root {
		display: flex;
		justify-content: center;
		align-items: center;
		margin: 80px 0;
		margin-bottom: 120px;
	}

	.root img {
		width: 450px;
		height: auto;
		max-width: 90vw;
	}

	@media (max-width: 640px) {
		.root img {
			width: 280px;
		}
	}

</style>