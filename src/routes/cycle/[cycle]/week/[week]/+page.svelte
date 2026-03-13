<script lang="ts">
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import SubjectTabs from '$lib/components/SubjectTabs.svelte';
	import VideoEmbed from '$lib/components/VideoEmbed.svelte';
	import WeekNav from '$lib/components/WeekNav.svelte';

	let { data } = $props();

	function splitWithLinks(text: string): { type: 'text' | 'link'; text: string }[] {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const parts: { type: 'text' | 'link'; text: string }[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = urlRegex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: 'text', text: text.slice(lastIndex, match.index) });
			}
			parts.push({ type: 'link', text: match[1] });
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < text.length) {
			parts.push({ type: 'text', text: text.slice(lastIndex) });
		}
		return parts;
	}
</script>

<svelte:head>
	<title>Cycle {data.cycle}, Week {data.week} — CC Tutor Resources</title>
</svelte:head>

<Breadcrumb
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: `Cycle ${data.cycle}`, href: `/cycle/${data.cycle}` },
		{ label: `Week ${data.week}` }
	]}
/>

<h1 class="font-serif text-3xl font-bold text-warm-800 mb-6">
	Cycle {data.cycle} — Week {data.week}
</h1>

<SubjectTabs activeSubject={data.activeSubject} availableSubjects={data.availableSubjects} />

<div class="mt-6">
	{#if data.activeSubject === 'Review'}
		<div class="rounded-xl bg-warm-100 p-8 text-center text-warm-700">
			<p class="text-lg font-medium">Review Game</p>
			<p class="mt-2">AI-powered review game coming soon!</p>
		</div>
	{:else if data.resources.length === 0}
		<div class="rounded-xl bg-warm-100 p-8 text-center text-warm-700">
			<p>No resources for {data.activeSubject} this week yet.</p>
		</div>
	{:else}
		<div class="space-y-8">
			{#each data.resources as resource}
				<div class="rounded-xl bg-warm-100 p-6 shadow-sm">
					<h3 class="font-serif text-xl font-bold text-warm-800 mb-4">
						{resource.title}
					</h3>
					<VideoEmbed url={resource.youtube_url} title={resource.title} />
					{#if resource.description}
						{@const lines = resource.description.split('\n').filter((l: string) => /https?:\/\//.test(l))}
						{#if lines.length > 0}
							<div class="mt-4 space-y-1 text-sm text-warm-700">
								{#each lines as line}
									<p>
										{#each splitWithLinks(line) as segment}
											{#if segment.type === 'link'}
												<a href={segment.text} target="_blank" rel="noopener noreferrer" class="text-terracotta-600 underline hover:text-terracotta-800 break-all">{segment.text}</a>
											{:else}
												{segment.text}
											{/if}
										{/each}
									</p>
								{/each}
							</div>
						{/if}
					{/if}
					{#if resource.notes}
						<p class="mt-4 text-warm-700">{resource.notes}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="mt-8">
	<WeekNav cycle={data.cycle} currentWeek={Number(data.week)} totalWeeks={data.totalWeeks} />
</div>
