import type { PageServerLoad } from './$types';
import { fetchResources, groupBySubject } from '$lib/sheets.server';
import { SUBJECTS } from '$lib/types';

export const load: PageServerLoad = async ({ params, url }) => {
	const resources = await fetchResources();
	const weekResources = resources.filter(
		(r) => r.cycle === params.cycle && r.week === params.week
	);

	const bySubject = groupBySubject(weekResources);
	const availableSubjects = [...bySubject.keys()];

	const requestedSubject = url.searchParams.get('subject');
	const activeSubject =
		requestedSubject && availableSubjects.includes(requestedSubject)
			? requestedSubject
			: availableSubjects[0] ?? SUBJECTS[0];

	const activeResources = bySubject.get(activeSubject) ?? [];

	return {
		cycle: params.cycle,
		week: params.week,
		activeSubject,
		availableSubjects,
		resources: activeResources.map((r) => ({
			title: r.title,
			youtube_url: r.youtube_url,
			notes: r.notes,
			description: r.description
		})),
		totalWeeks: 24
	};
};
