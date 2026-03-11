<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-screen bg-warm-white">
	<header class="border-b border-warm-200 bg-white">
		<div class="mx-auto max-w-5xl px-4 py-4">
			<a href="/" class="font-serif text-2xl font-bold text-warm-800 hover:text-terracotta transition-colors">
				CC Tutor Resources
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t border-warm-200 bg-white mt-12">
		<div class="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-warm-700">
			Curated resources for Classical Conversations tutors
		</div>
	</footer>
</div>
