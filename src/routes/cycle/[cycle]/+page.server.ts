import type { PageServerLoad } from './$types';
import { fetchResources, getWeeks, groupByWeek } from '$lib/sheets.server';

export const load: PageServerLoad = async ({ params }) => {
	const resources = await fetchResources();
	const cycleResources = resources.filter((r) => r.cycle === params.cycle);
	const weeks = getWeeks(cycleResources);
	const byWeek = groupByWeek(cycleResources);

	const weekData = weeks.map((week) => ({
		week,
		resourceCount: byWeek.get(week)?.length ?? 0
	}));

	return {
		cycle: params.cycle,
		weeks: weekData
	};
};
