<script lang="ts">
	import { SUBJECTS } from '$lib/types';

	let { activeSubject, availableSubjects }: { activeSubject: string; availableSubjects: string[] } = $props();
</script>

<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
	{#each SUBJECTS as subject}
		{@const isAvailable = availableSubjects.includes(subject)}
		{@const isActive = activeSubject === subject}
		<a
			href={isAvailable ? `?subject=${encodeURIComponent(subject)}` : undefined}
			class="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors
				{isActive
					? 'bg-terracotta text-white shadow-sm'
					: isAvailable
						? 'bg-warm-200 text-warm-700 hover:bg-warm-300'
						: 'cursor-default bg-warm-100 text-warm-300'}"
		>
			{subject}
		</a>
	{/each}
</div>
