import type { PageServerLoad } from './$types';
import { fetchResources, getCycles, groupByCycle } from '$lib/sheets.server';

export const load: PageServerLoad = async () => {
	const resources = await fetchResources();
	const cycles = getCycles(resources);
	const byCycle = groupByCycle(resources);

	const cycleData = cycles.map((cycle) => ({
		cycle,
		weekCount: new Set(byCycle.get(cycle)?.map((r) => r.week) ?? []).size
	}));

	return { cycles: cycleData };
};
