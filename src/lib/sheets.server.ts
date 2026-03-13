import { SHEET_CSV_URL } from '$env/static/private';
import type { Resource } from './types';

export { type Resource } from './types';
export { SUBJECTS, type Subject } from './types';

function parseCsvRecords(csv: string): string[][] {
	const records: string[][] = [];
	let current = '';
	let inQuotes = false;
	const fields: string[] = [];

	for (let i = 0; i < csv.length; i++) {
		const char = csv[i];
		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < csv.length && csv[i + 1] === '"') {
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
				fields.push(current);
				current = '';
			} else if (char === '\n' || (char === '\r' && csv[i + 1] === '\n')) {
				fields.push(current);
				current = '';
				records.push([...fields]);
				fields.length = 0;
				if (char === '\r') i++;
			} else {
				current += char;
			}
		}
	}
	if (current || fields.length > 0) {
		fields.push(current);
		records.push(fields);
	}
	return records;
}

function parseCSV(csv: string): Resource[] {
	const records = parseCsvRecords(csv.trim());
	if (records.length < 2) return [];

	const headers = records[0].map((h) => h.trim().toLowerCase());

	return records
		.slice(1)
		.map((values) => {
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
				notes: row['notes'] ?? '',
				description: row['description'] ?? ''
			};
		})
		.filter((r) => r.cycle && r.week && r.subject);
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
