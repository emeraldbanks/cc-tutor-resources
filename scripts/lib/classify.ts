// Keywords used to auto-classify videos into subjects
const SUBJECT_KEYWORDS: Record<string, string[]> = {
	History: ['history', 'historical'],
	Science: ['science', 'scientific', 'experiment'],
	'Hands-on Science': ['hands-on', 'hands on', 'experiment', 'lab'],
	Math: ['math', 'mathematics', 'multiplication', 'arithmetic', 'geometry'],
	Latin: ['latin', 'conjugat', 'declens', 'vocabulary'],
	Geography: ['geography', 'map', 'continent', 'country', 'countries'],
	English: ['english', 'grammar', 'sentence', 'writing', 'essay'],
	Timeline: ['timeline', 'time line', 'timeline song', 'timeline cards'],
	'Fine Arts': ['fine arts', 'art', 'drawing', 'painting', 'music', 'composer', 'artist'],
};

// Check more specific subjects first to avoid misclassification
const SUBJECT_ORDER = [
	'Hands-on Science',
	'Fine Arts',
	'Timeline',
	'Latin',
	'Geography',
	'English',
	'Math',
	'History',
	'Science',
];

export function classifySubject(title: string): string {
	const lower = title.toLowerCase();
	for (const subject of SUBJECT_ORDER) {
		const keywords = SUBJECT_KEYWORDS[subject];
		if (keywords?.some((kw) => lower.includes(kw))) return subject;
	}
	return 'Unknown';
}

/**
 * Extract week number from a video title.
 * Matches patterns like: "week 18", "wk 18", "w18", "week18"
 */
export function extractWeek(title: string): string | null {
	const match = title.match(/\bweek\s*(\d+)\b/i) ?? title.match(/\bwk\s*(\d+)\b/i) ?? title.match(/\bw(\d+)\b/i);
	return match ? match[1] : null;
}

/**
 * Extract cycle number from a video title.
 * Matches patterns like: "cycle 2", "cycle2", "c2"
 */
export function extractCycle(title: string): string | null {
	const match = title.match(/\bcycle\s*(\d+)\b/i) ?? title.match(/\bc(\d)\b/i);
	return match ? match[1] : null;
}

import { getDB } from './db.js';

/**
 * Re-extract cycle, week, and subject from titles for all videos in a cycle.
 * Fixes misclassifications from earlier runs. Videos whose cycle changes
 * get moved to the correct cycle.
 */
export function reclassifyVideos(cycle: string): void {
	const db = getDB();
	const videos = db
		.prepare('SELECT video_id, title, cycle, week, subject FROM videos WHERE cycle = ?')
		.all(cycle) as { video_id: string; title: string; cycle: string | null; week: string | null; subject: string | null }[];

	let updated = 0;
	let moved = 0;

	const stmt = db.prepare('UPDATE videos SET cycle = ?, week = ?, subject = ? WHERE video_id = ?');
	const tx = db.transaction(() => {
		for (const v of videos) {
			const newCycle = extractCycle(v.title) ?? cycle;
			const newWeek = extractWeek(v.title);
			const newSubject = classifySubject(v.title);
			const subject = newSubject !== 'Unknown' ? newSubject : v.subject;

			if (newCycle !== v.cycle || newWeek !== v.week || subject !== v.subject) {
				stmt.run(newCycle, newWeek, subject, v.video_id);
				updated++;
				if (newCycle !== v.cycle) {
					moved++;
					console.log(`  Moved: "${v.title.slice(0, 60)}" cycle ${v.cycle} → ${newCycle}`);
				}
			}
		}
	});
	tx();

	console.log(`\nReclassified ${videos.length} videos: ${updated} updated, ${moved} moved to a different cycle.`);
}

export function decodeHTMLEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
}
