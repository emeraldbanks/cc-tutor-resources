<script lang="ts">
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import WeekCard from '$lib/components/WeekCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Cycle {data.cycle} — CC Tutor Resources</title>
</svelte:head>

<Breadcrumb
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: `Cycle ${data.cycle}` }
	]}
/>

<h1 class="font-serif text-3xl font-bold text-warm-800 mb-6">
	Cycle {data.cycle}
</h1>

{#if data.weeks.length === 0}
	<div class="rounded-xl bg-warm-100 p-8 text-center text-warm-700">
		<p>No weeks found for Cycle {data.cycle}.</p>
	</div>
{:else}
	<div class="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
		{#each data.weeks as { week, resourceCount }}
			<WeekCard cycle={data.cycle} {week} {resourceCount} />
		{/each}
	</div>
{/if}
