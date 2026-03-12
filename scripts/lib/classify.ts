// Keywords used to auto-classify videos into subjects
const SUBJECT_KEYWORDS: Record<string, (string | RegExp)[]> = {
	History: ['history', 'historical'],
	Science: ['science', 'scientific', 'experiment'],
	'Hands-on Science': ['hands-on', 'hands on', 'experiment', 'lab'],
	Math: ['math', 'mathematics', 'multiplication', 'arithmetic', 'geometry'],
	Latin: ['latin', 'conjugat', 'declens', 'vocabulary'],
	Geography: ['geography', /\bmap\b/, 'continent', 'country', 'countries'],
	English: ['english', 'grammar', 'sentence', 'writing', 'essay'],
	Timeline: ['timeline', 'time line', 'timeline song', 'timeline cards'],
	'Fine Arts': ['fine arts', /\bart\b/, 'drawing', 'painting', 'music', 'composer', 'artist'],
	General: ['tutor', 'memory work', 'memory master', 'review game'],
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
	'General',
];

export function classifySubject(title: string): string {
	const lower = title.toLowerCase();
	for (const subject of SUBJECT_ORDER) {
		const keywords = SUBJECT_KEYWORDS[subject];
		if (keywords?.some((kw) => (typeof kw === 'string' ? lower.includes(kw) : kw.test(lower)))) return subject;
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
 * Extract all week numbers from a video title, handling ranges and lists.
 * "Weeks 2-12" → ['2','3',...,'12']
 * "Weeks 16, 17, 18" → ['16','17','18']
 * "Weeks 20, 22-24" → ['20','22','23','24']
 * Falls back to extractWeek for single-week patterns.
 */
export function extractWeeks(title: string): string[] {
	// Match "weeks X-Y" or "weeks X, Y, Z" patterns (with optional ranges in the list)
	const multiMatch = title.match(/\bweeks?\s+([\d\s,\-]+)/i);
	if (multiMatch) {
		const raw = multiMatch[1].trim();
		const weeks: string[] = [];
		for (const part of raw.split(/\s*,\s*/)) {
			const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
			if (rangeMatch) {
				const start = parseInt(rangeMatch[1], 10);
				const end = parseInt(rangeMatch[2], 10);
				for (let i = start; i <= end; i++) {
					weeks.push(String(i));
				}
			} else {
				const num = part.trim();
				if (/^\d+$/.test(num)) {
					weeks.push(num);
				}
			}
		}
		if (weeks.length > 1) return weeks;
		// If we only got 1 week from the multi-pattern, still return it
		if (weeks.length === 1) return weeks;
	}
	// Fallback to single week extraction
	const single = extractWeek(title);
	return single ? [single] : [];
}

/**
 * Detect clearly irrelevant videos by title patterns.
 */
export function isNotRelevant(title: string): boolean {
	const lower = title.toLowerCase();
	const patterns = [
		/\bthank you\b/,
		/\bfinale\b/,
		/\bgoodbye\b/,
		/\bwhen are the .* coming\b/,
		/\bweek in the life\b/,
		/\bday in the life\b/,
		/\ba peek into\b/,
		/\bregistration\b/,
		/\binfo session\b/,
	];
	return patterns.some((p) => p.test(lower));
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

	const stmt = db.prepare('UPDATE videos SET cycle = ?, week = ?, subject = ? WHERE video_id = ? AND week = ?');
	const deleteStmt = db.prepare('DELETE FROM videos WHERE video_id = ? AND week = ?');
	const insertStmt = db.prepare(`
		INSERT OR IGNORE INTO videos (video_id, title, channel_id, youtube_url, cycle, week, subject, relevant, transcript, transcript_fetched, exported, created_at)
		SELECT video_id, title, channel_id, youtube_url, ?, ?, ?, relevant, transcript, transcript_fetched, exported, created_at
		FROM videos WHERE video_id = ? AND week = ?
	`);
	const tx = db.transaction(() => {
		for (const v of videos) {
			const newCycle = extractCycle(v.title) ?? cycle;
			const newSubject = classifySubject(v.title);
			const subject = newSubject !== 'Unknown' ? newSubject : null;
			const newWeeks = extractWeeks(v.title);
			const newWeek = newWeeks.length === 1 ? newWeeks[0] : (newWeeks.length === 0 ? null : v.week);

			if (newCycle !== v.cycle || newWeek !== v.week || subject !== v.subject) {
				stmt.run(newCycle, newWeek, subject, v.video_id, v.week);
				updated++;
				if (newCycle !== v.cycle) {
					moved++;
					console.log(`  Moved: "${v.title.slice(0, 60)}" cycle ${v.cycle} → ${newCycle}`);
				}
			}

			// If the video has multiple weeks, create additional rows
			if (newWeeks.length > 1) {
				for (const w of newWeeks) {
					if (w !== v.week) {
						insertStmt.run(newCycle, w, subject, v.video_id, v.week ?? newWeeks[0]);
					}
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
