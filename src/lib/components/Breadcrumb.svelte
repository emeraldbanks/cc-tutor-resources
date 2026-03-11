<script lang="ts">
	interface Crumb {
		label: string;
		href?: string;
	}

	let { crumbs }: { crumbs: Crumb[] } = $props();
</script>

<nav class="mb-6 text-sm text-warm-700">
	<ol class="flex items-center gap-1">
		{#each crumbs as crumb, i}
			{#if i > 0}
				<li class="text-warm-300">/</li>
			{/if}
			<li>
				{#if crumb.href}
					<a href={crumb.href} class="text-terracotta hover:text-terracotta-light transition-colors">
						{crumb.label}
					</a>
				{:else}
					<span class="font-medium text-warm-800">{crumb.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
