<script lang="ts">
	import CycleCard from '$lib/components/CycleCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>CC Tutor Resources</title>
</svelte:head>

<div class="text-center mb-10">
	<h1 class="font-serif text-4xl font-bold text-warm-800 mb-3">
		Classical Conversations Resources
	</h1>
	<p class="text-lg text-warm-700">
		Curated YouTube resources organized by cycle, week, and subject.
	</p>
</div>

{#if data.cycles.length === 0}
	<div class="rounded-xl bg-warm-100 p-8 text-center text-warm-700">
		<p class="text-lg font-medium">No resources available yet.</p>
		<p class="mt-2">Connect a Google Sheet with your resources to get started.</p>
	</div>
{:else}
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.cycles as { cycle, weekCount }}
			<CycleCard {cycle} {weekCount} />
		{/each}
	</div>
{/if}
