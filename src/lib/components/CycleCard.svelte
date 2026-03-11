<script lang="ts">
	let { cycle, weekCount }: { cycle: string; weekCount: number } = $props();
</script>

<a
	href="/cycle/{cycle}"
	class="group block rounded-xl bg-warm-100 p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
>
	<h2 class="font-serif text-3xl font-bold text-warm-800 group-hover:text-terracotta transition-colors">
		Cycle {cycle}
	</h2>
	<p class="mt-2 text-warm-700">
		{weekCount} weeks of resources
	</p>
</a>
