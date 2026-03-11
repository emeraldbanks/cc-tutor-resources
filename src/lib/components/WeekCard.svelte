<script lang="ts">
	let { cycle, week, resourceCount }: { cycle: string; week: string; resourceCount: number } = $props();
</script>

<a
	href="/cycle/{cycle}/week/{week}"
	class="group block rounded-xl bg-warm-100 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
>
	<h3 class="font-serif text-xl font-bold text-warm-800 group-hover:text-terracotta transition-colors">
		Week {week}
	</h3>
	<p class="mt-1 text-sm text-warm-700">
		{resourceCount} {resourceCount === 1 ? 'resource' : 'resources'}
	</p>
</a>
