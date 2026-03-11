import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getVideos, markExported, type VideoRow } from './db.js';

function escapeCSV(val: string): string {
	if (val.includes(',') || val.includes('"') || val.includes('\n')) {
		return `"${val.replace(/"/g, '""')}"`;
	}
	return val;
}

export function exportCSV(cycle: string, week?: string): void {
	const videos = getVideos({ cycle, week });
	if (videos.length === 0) {
		console.log('No videos to export.');
		return;
	}

	const outDir = join(import.meta.dirname!, '..', 'data', 'output');
	mkdirSync(outDir, { recursive: true });

	const baseName = week ? `cycle${cycle}-week${week}` : `cycle${cycle}`;

	// CSV matching sheet format: cycle,week,subject,youtube_url,title,notes
	const csvRows = ['cycle,week,subject,youtube_url,title,notes'];
	for (const v of videos) {
		csvRows.push(
			[
				escapeCSV(v.cycle ?? ''),
				escapeCSV(v.week ?? ''),
				escapeCSV(v.subject ?? ''),
				escapeCSV(v.youtube_url),
				escapeCSV(v.title),
				escapeCSV(v.channel_name ?? ''),
			].join(',')
		);
	}

	const csvPath = join(outDir, `${baseName}.csv`);
	writeFileSync(csvPath, csvRows.join('\n') + '\n');
	console.log(`CSV written: ${csvPath} (${videos.length} videos)`);

	// JSON with full data including transcripts
	const jsonData = videos.map((v) => ({
		cycle: v.cycle,
		week: v.week,
		subject: v.subject,
		youtube_url: v.youtube_url,
		title: v.title,
		channelTitle: v.channel_name,
		transcript: v.transcript ?? null,
	}));
	const jsonPath = join(outDir, `${baseName}.json`);
	writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2) + '\n');
	console.log(`JSON written: ${jsonPath}`);

	markExported(videos.map((v) => v.video_id));
}
