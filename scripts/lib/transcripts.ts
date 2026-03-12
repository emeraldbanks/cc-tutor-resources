import { execSync } from 'child_process';
import { readFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getVideos, setTranscript, type VideoRow } from './db.js';

export function fetchTranscript(videoId: string): string | null {
	const outDir = join(tmpdir(), 'cc-transcripts');
	mkdirSync(outDir, { recursive: true });
	const outTemplate = join(outDir, videoId);
	const url = `https://www.youtube.com/watch?v=${videoId}`;

	try {
		execSync(
			`yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format vtt -o "${outTemplate}" "${url}"`,
			{ timeout: 30_000, stdio: 'pipe' }
		);
	} catch {
		return null;
	}

	const candidates = [`${outTemplate}.en.vtt`, `${outTemplate}.en-orig.vtt`];
	const vttPath = candidates.find((p) => existsSync(p));
	if (!vttPath) return null;

	const vtt = readFileSync(vttPath, 'utf-8');
	for (const p of candidates) {
		if (existsSync(p)) unlinkSync(p);
	}

	return parseVTT(vtt);
}

function parseVTT(vtt: string): string {
	return vtt
		.split('\n')
		.filter((line) => {
			const t = line.trim();
			if (!t) return false;
			if (t.startsWith('WEBVTT')) return false;
			if (/^\d{2}:\d{2}/.test(t)) return false;
			if (/^Kind:|^Language:|^NOTE/.test(t)) return false;
			if (/^\d+$/.test(t)) return false;
			return true;
		})
		.map((line) => line.replace(/<[^>]+>/g, '').trim())
		.filter((line, i, arr) => line && line !== arr[i - 1])
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export async function fetchTranscripts(cycle: string, week?: string): Promise<void> {
	// Check yt-dlp is available
	try {
		execSync('which yt-dlp', { stdio: 'pipe' });
	} catch {
		console.error('Error: yt-dlp not found on PATH. Install it: brew install yt-dlp');
		process.exit(1);
	}

	const videos = getVideos({ cycle, week, transcriptNeeded: true });
	if (videos.length === 0) {
		console.log('No videos need transcripts.');
		return;
	}

	console.log(`\nFetching transcripts for ${videos.length} videos...\n`);

	let success = 0;
	let failed = 0;

	for (const video of videos) {
		process.stdout.write(`  ${video.title.slice(0, 60)}... `);
		const transcript = fetchTranscript(video.video_id);
		setTranscript(video.video_id, transcript);

		if (transcript) {
			console.log(`✓ (${transcript.length} chars)`);
			success++;
		} else {
			console.log('✗ (unavailable)');
			failed++;
		}
	}

	console.log(`\nDone: ${success} fetched, ${failed} unavailable`);
}
