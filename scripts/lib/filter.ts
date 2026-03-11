import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getDB, getUnfilteredVideos, setRelevance, type VideoRow } from './db.js';
import { extractWeek } from './classify.js';

interface FilterResult {
	video_id: string;
	relevant: boolean;
	week: string | null;
	subject: string | null;
	reason: string;
}

/**
 * Auto-mark videos that have a week number in the title as relevant.
 * Returns the count of auto-approved videos.
 */
export function autoApproveWithWeek(cycle: string): number {
	const db = getDB();
	const videos = db
		.prepare("SELECT video_id, title FROM videos WHERE cycle = ? AND relevant IS NULL")
		.all(cycle) as { video_id: string; title: string }[];

	let approved = 0;
	for (const v of videos) {
		const week = extractWeek(v.title);
		if (week) {
			setRelevance(v.video_id, true);
			approved++;
		}
	}
	return approved;
}

/**
 * Send titles without week numbers to Claude Code for relevance classification.
 * Uses `claude -p` to leverage the user's Max subscription.
 */
export async function filterWithLLM(cycle: string): Promise<void> {
	const videos = getUnfilteredVideos(cycle);

	if (videos.length === 0) {
		console.log('No videos need filtering.');
		return;
	}

	console.log(`\nSending ${videos.length} titles to Claude Code for classification...\n`);

	// Batch in groups of 50 to keep prompts manageable
	const batchSize = 50;
	let totalRelevant = 0;
	let totalDropped = 0;

	for (let i = 0; i < videos.length; i += batchSize) {
		const batch = videos.slice(i, i + batchSize);
		console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videos.length / batchSize)}...`);
		const results = classifyBatch(batch, cycle);

		for (const r of results) {
			setRelevance(r.video_id, r.relevant, r.week ?? undefined, r.subject ?? undefined);
			if (r.relevant) {
				totalRelevant++;
			} else {
				totalDropped++;
				console.log(`    ✗ ${batch.find(v => v.video_id === r.video_id)?.title ?? r.video_id} — ${r.reason}`);
			}
		}
	}

	console.log(`\nFiltered: ${totalRelevant} relevant, ${totalDropped} dropped`);
}

function classifyBatch(videos: VideoRow[], cycle: string): FilterResult[] {
	const videoList = videos
		.map((v, i) => `${i + 1}. [${v.video_id}] "${v.title}" (channel: ${v.channel_name ?? 'unknown'})`)
		.join('\n');

	const prompt = `You are classifying YouTube video titles for a Classical Conversations (CC) homeschool curriculum resource site.

I need you to determine which videos are **CC curriculum tutorial/review videos** for Cycle ${cycle}, and which are NOT relevant.

**RELEVANT videos** — keep these:
- Videos that teach or review specific CC curriculum content (history sentences, science facts, math, Latin, geography, English grammar, timeline, fine arts)
- Videos titled like "CC Cycle 2 Week 5 History" or "Classical Conversations Science Review"
- Song/memory work videos for CC content
- Videos that cover CC curriculum even if they don't mention a specific week

**NOT RELEVANT videos** — drop these:
- General homeschool tips, advice, vlogs, day-in-the-life
- Product reviews, hauls, unboxings
- Videos about CC the organization (registration, community days, info sessions)
- Videos clearly for a different cycle than Cycle ${cycle}
- Devotionals, encouragement, Q&A not tied to curriculum content

For each video, respond with a JSON array of objects:
[
  {
    "video_id": "...",
    "relevant": true or false,
    "week": "18" or null,
    "subject": "History" or null,
    "reason": "brief reason"
  }
]

Valid subjects: History, Science, Hands-on Science, Math, Latin, Geography, English, Timeline, Fine Arts

Here are the videos:
${videoList}

Respond with ONLY the JSON array, no other text.`;

	// Write prompt to temp file to avoid arg length / escaping issues
	const tmpFile = join(tmpdir(), `cc-filter-${Date.now()}.txt`);
	writeFileSync(tmpFile, prompt);

	try {
		const output = execFileSync('claude', ['-p', '--model', 'haiku', '--no-session-persistence', prompt], {
			timeout: 120_000,
			stdio: ['pipe', 'pipe', 'pipe'],
			maxBuffer: 10 * 1024 * 1024,
			env: { ...process.env, CLAUDECODE: '' },
		}).toString();

		// Extract JSON from response (handle markdown code blocks)
		const jsonMatch = output.match(/\[[\s\S]*\]/);
		if (!jsonMatch) throw new Error('No JSON array found in response');
		const results: FilterResult[] = JSON.parse(jsonMatch[0]);

		// Only return results for videos Claude actually classified
		const validIds = new Set(videos.map((v) => v.video_id));
		return results.filter((r) => validIds.has(r.video_id));
	} catch (err: any) {
		const stderr = err?.stderr?.toString?.() ?? '';
		const stdout = err?.stdout?.toString?.() ?? '';
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`  Failed to classify batch: ${msg}`);
		if (stderr) console.error(`  stderr: ${stderr}`);
		if (stdout) console.error(`  stdout: ${stdout.slice(0, 500)}`);
		return [];
	} finally {
		try { unlinkSync(tmpFile); } catch {}
	}
}
