<script lang="ts">
	import { getYouTubeId } from '$lib/utils';

	let { url, title }: { url: string; title: string } = $props();

	const videoId = $derived(getYouTubeId(url));
</script>

{#if videoId}
	<div class="aspect-video w-full overflow-hidden rounded-lg shadow-md">
		<iframe
			src="https://www.youtube.com/embed/{videoId}"
			{title}
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
			class="h-full w-full"
		></iframe>
	</div>
{:else}
	<div class="rounded-lg bg-warm-200 p-4 text-warm-700">
		<p>Unable to load video: <a href={url} target="_blank" rel="noopener" class="text-terracotta underline">{url}</a></p>
	</div>
{/if}
