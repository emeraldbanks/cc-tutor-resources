<script lang="ts">
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import SubjectTabs from '$lib/components/SubjectTabs.svelte';
	import VideoEmbed from '$lib/components/VideoEmbed.svelte';
	import WeekNav from '$lib/components/WeekNav.svelte';

	let { data } = $props();
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
