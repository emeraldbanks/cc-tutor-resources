import { SHEET_CSV_URL } from '$env/static/private';
import type { Resource } from './types';

export { type Resource } from './types';
export { SUBJECTS, type Subject } from './types';

function parseCSV(csv: string): Resource[] {
	const lines = csv.trim().split('\n');
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

	return lines
		.slice(1)
		.map((line) => {
			const values = parseCsvLine(line);
			const row: Record<string, string> = {};
			headers.forEach((h, i) => {
				row[h] = (values[i] ?? '').trim();
			});
			return {
				cycle: row['cycle'] ?? '',
				week: row['week'] ?? '',
				subject: row['subject'] ?? '',
				youtube_url: row['youtube_url'] ?? '',
				title: row['title'] ?? '',
				notes: row['notes'] ?? ''
			};
		})
		.filter((r) => r.cycle && r.week && r.subject);
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				result.push(current);
				current = '';
			} else {
				current += char;
			}
		}
	}
	result.push(current);
	return result;
}

export async function fetchResources(): Promise<Resource[]> {
	const res = await fetch(SHEET_CSV_URL);
	if (!res.ok) {
		console.error(`Failed to fetch sheet: ${res.status}`);
		return [];
	}
	const csv = await res.text();
	return parseCSV(csv);
}

export function groupByCycle(resources: Resource[]): Map<string, Resource[]> {
	const map = new Map<string, Resource[]>();
	for (const r of resources) {
		const key = r.cycle;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(r);
	}
	return map;
}

export function groupByWeek(resources: Resource[]): Map<string, Resource[]> {
	const map = new Map<string, Resource[]>();
	for (const r of resources) {
		const key = r.week;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(r);
	}
	return map;
}

export function groupBySubject(resources: Resource[]): Map<string, Resource[]> {
	const map = new Map<string, Resource[]>();
	for (const r of resources) {
		const key = r.subject;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(r);
	}
	return map;
}

export function getCycles(resources: Resource[]): string[] {
	const cycles = [...new Set(resources.map((r) => r.cycle))];
	return cycles.sort((a, b) => Number(a) - Number(b));
}

export function getWeeks(resources: Resource[]): string[] {
	const weeks = [...new Set(resources.map((r) => r.week))];
	return weeks.sort((a, b) => Number(a) - Number(b));
}
