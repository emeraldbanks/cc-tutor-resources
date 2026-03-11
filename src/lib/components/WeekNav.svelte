<script lang="ts">
	let { cycle, currentWeek, totalWeeks }: { cycle: string; currentWeek: number; totalWeeks: number } = $props();

	const prevWeek = $derived(currentWeek > 1 ? currentWeek - 1 : null);
	const nextWeek = $derived(currentWeek < totalWeeks ? currentWeek + 1 : null);
</script>

<div class="flex items-center justify-between">
	{#if prevWeek}
		<a
			href="/cycle/{cycle}/week/{prevWeek}"
			class="flex items-center gap-1 rounded-lg bg-warm-200 px-4 py-2 text-warm-700 transition-colors hover:bg-warm-300"
		>
			&larr; Week {prevWeek}
		</a>
	{:else}
		<div></div>
	{/if}

	{#if nextWeek}
		<a
			href="/cycle/{cycle}/week/{nextWeek}"
			class="flex items-center gap-1 rounded-lg bg-warm-200 px-4 py-2 text-warm-700 transition-colors hover:bg-warm-300"
		>
			Week {nextWeek} &rarr;
		</a>
	{:else}
		<div></div>
	{/if}
</div>
